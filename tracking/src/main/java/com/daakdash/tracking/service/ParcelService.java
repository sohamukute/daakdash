package com.daakdash.tracking.service;

import com.daakdash.tracking.dto.*;
import com.daakdash.tracking.model.*;
import com.daakdash.tracking.repository.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ParcelService {

    static final int TRAIN_KM = 250;      // at or beyond this, rail beats road
    static final int PARTNER_LOAD = 12;   // a partner carries up to this many active deliveries
    static final int ABSENT_DAYS = 3;     // hold before retrying a parcel whose receiver was out

    private final ParcelRepository parcels;
    private final ParcelEventRepository events;
    private final BatchRepository batches;
    private final DepotRepository depots;
    private final OtpService otp;
    private final SmsService sms;

    public ParcelService(ParcelRepository parcels, ParcelEventRepository events,
                         BatchRepository batches, DepotRepository depots, OtpService otp,
                         SmsService sms) {
        this.parcels = parcels;
        this.events = events;
        this.batches = batches;
        this.depots = depots;
        this.otp = otp;
        this.sms = sms;
    }

    // ---- seller: book parcels ----

    @Transactional
    public ParcelResponse create(String sellerEmail, CreateParcelRequest r) {
        Depot origin = depotByCity(r.originCity());
        Depot dest = depotByCity(r.destCity());
        if (origin.getId().equals(dest.getId()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "origin and destination city are the same");
        int qty = r.quantity() == null || r.quantity() < 1 ? 1 : r.quantity();
        Parcel p = new Parcel(newTrackingNumber(), sellerEmail, r.itemName(), qty,
            r.receiverName(), r.receiverPhone(), r.receiverAddress(),
            origin.getCity(), dest.getCity(), origin.getId(), dest.getId(), otp.generate());
        p = parcels.save(p);
        logEvent(p, ParcelStatus.BOOKED, origin.getId(), "booked by seller");
        return ParcelResponse.from(p);
    }

    public Page<SellerView> listForSeller(String sellerEmail, Pageable pg) {
        return parcels.findBySellerEmailOrderByCreatedAtDesc(sellerEmail, pg).map(SellerView::from);
    }

    // ---- public tracking ----

    public TrackView track(String trackingNumber) {
        Parcel p = require(trackingNumber);
        Map<Long, String> city = depotCityMap();
        List<TrackView.Step> steps = events.findByParcelIdOrderByCreatedAtAsc(p.getId()).stream()
            .map(e -> new TrackView.Step(e.getStatus(),
                e.getDepotId() == null ? null : city.get(e.getDepotId()), e.getCreatedAt()))
            .toList();
        // the OTP goes to the receiver's phone by sms, never onto the public page
        return new TrackView(p.getTrackingNumber(), p.getStatus(), p.getOriginCity(), p.getDestCity(), steps);
    }

    // ---- origin depot: receive dropped parcels, sort and dispatch ----

    public List<ParcelResponse> inboundAtOrigin(Long depotId) {
        return parcels.findByOriginDepotIdAndStatus(depotId, ParcelStatus.BOOKED)
            .stream().map(ParcelResponse::from).toList();
    }

    @Transactional
    public void scanInAtOrigin(Long depotId, String trackingNumber) {
        Parcel p = require(trackingNumber);
        if (!p.getOriginDepotId().equals(depotId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "parcel does not belong to this depot");
        move(p, ParcelStatus.AT_ORIGIN_DEPOT, depotId, "received at origin depot");
    }

    // parcels scanned in and waiting to go out, grouped by destination into dispatchable lanes
    public List<LaneGroup> lanes(Long depotId) {
        List<Parcel> waiting = parcels.findByOriginDepotIdAndStatus(depotId, ParcelStatus.AT_ORIGIN_DEPOT);
        Map<Long, List<Parcel>> byDest = waiting.stream().collect(Collectors.groupingBy(Parcel::getDestDepotId));
        Map<Long, Depot> depotById = depotMap();
        Depot from = depotById.get(depotId);
        List<LaneGroup> out = new ArrayList<>();
        byDest.forEach((destId, list) -> {
            Depot to = depotById.get(destId);
            int km = distanceKm(from, to);
            out.add(new LaneGroup(destId, to.getCity(), modeFor(km), km, list.size()));
        });
        out.sort((a, b) -> Integer.compare(b.parcelCount(), a.parcelCount()));
        return out;
    }

    @Transactional
    public int dispatchLane(Long originDepotId, Long destDepotId) {
        List<Parcel> load = parcels.findByOriginDepotIdAndStatus(originDepotId, ParcelStatus.AT_ORIGIN_DEPOT)
            .stream().filter(p -> p.getDestDepotId().equals(destDepotId)).toList();
        if (load.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "no parcels waiting for this lane");
        int km = distanceKm(depotMap().get(originDepotId), depotMap().get(destDepotId));
        Batch batch = batches.save(new Batch(originDepotId, destDepotId, modeFor(km)));
        for (Parcel p : load) {
            move(p, ParcelStatus.SORTED, originDepotId, "sorted for " + p.getDestCity());
            move(p, ParcelStatus.IN_TRANSIT, originDepotId, "departed on batch " + batch.getId());
            p.setBatchId(batch.getId());
        }
        batch.depart();
        return load.size();
    }

    // ---- destination depot: receive incoming batches ----

    public List<BatchResponse> inboundBatches(Long depotId) {
        return batches.findByDestDepotIdAndStatus(depotId, BatchStatus.DEPARTED)
            .stream().map(BatchResponse::from).toList();
    }

    // parcels received at this depot and now waiting for a delivery partner to come online
    public List<ParcelResponse> waitingAtDest(Long depotId) {
        return parcels.findByDestDepotIdAndStatusOrderByUpdatedAtAsc(depotId, ParcelStatus.AT_DEST_DEPOT)
            .stream().map(ParcelResponse::from).toList();
    }

    @Transactional
    public int arriveBatch(Long depotId, Long batchId) {
        Batch b = batches.findById(batchId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "batch not found"));
        if (!b.getDestDepotId().equals(depotId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "batch is not bound for this depot");
        if (b.getStatus() != BatchStatus.DEPARTED)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "batch is not in transit");
        List<Parcel> load = parcels.findByBatchId(batchId);
        for (Parcel p : load) {
            if (p.getStatus() == ParcelStatus.IN_TRANSIT)
                move(p, ParcelStatus.AT_DEST_DEPOT, depotId, "arrived at destination depot");
        }
        b.arrive();
        return load.size();
    }

    // ---- delivery partner ----

    // going online pulls a fresh load of parcels waiting at the partner's depot.
    @Transactional
    public int goOnline(String partnerEmail, Long depotId) {
        long current = parcels.countByAssignedPartnerAndStatus(partnerEmail, ParcelStatus.OUT_FOR_DELIVERY);
        int slots = (int) (PARTNER_LOAD - current);
        if (slots <= 0) return 0;
        Instant now = Instant.now();
        List<Parcel> waiting = parcels
            .findByDestDepotIdAndStatusOrderByUpdatedAtAsc(depotId, ParcelStatus.AT_DEST_DEPOT).stream()
            .filter(p -> p.getAbsentUntil() == null || p.getAbsentUntil().isBefore(now))
            .limit(slots).toList();
        for (Parcel p : waiting) {
            p.setAssignedPartner(partnerEmail);
            move(p, ParcelStatus.OUT_FOR_DELIVERY, depotId, "out for delivery with partner");
        }
        return waiting.size();
    }

    public void requireCanGoOffline(String partnerEmail) {
        if (parcels.countByAssignedPartnerAndStatus(partnerEmail, ParcelStatus.OUT_FOR_DELIVERY) > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "deliver all assigned parcels before going offline");
    }

    public List<PartnerView> partnerLoad(String partnerEmail) {
        return parcels.findByAssignedPartnerAndStatus(partnerEmail, ParcelStatus.OUT_FOR_DELIVERY)
            .stream().map(PartnerView::from).toList();
    }

    // the partner presses "send OTP" at the doorstep; only then does the receiver get the code
    public void sendDeliveryOtp(String partnerEmail, String trackingNumber) {
        Parcel p = requireAssigned(partnerEmail, trackingNumber);
        sms.sendOtp(p.getReceiverPhone(), p.getOtp(), p.getTrackingNumber());
    }

    @Transactional
    public void deliver(String partnerEmail, String trackingNumber, String otpCode) {
        Parcel p = requireAssigned(partnerEmail, trackingNumber);
        if (!p.getOtp().equals(otpCode))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "wrong OTP");
        move(p, ParcelStatus.DELIVERED, p.getDestDepotId(), "delivered, OTP verified");
    }

    @Transactional
    public void markAbsent(String partnerEmail, String trackingNumber) {
        Parcel p = requireAssigned(partnerEmail, trackingNumber);
        move(p, ParcelStatus.RECEIVER_ABSENT, p.getDestDepotId(), "receiver not available");
        p.setAbsentUntil(Instant.now().plus(Duration.ofDays(ABSENT_DAYS)));
        p.setAssignedPartner(null);
        move(p, ParcelStatus.AT_DEST_DEPOT, p.getDestDepotId(), "returned to depot, retry in " + ABSENT_DAYS + " days");
    }

    // ---- helpers ----

    private Parcel requireAssigned(String partnerEmail, String trackingNumber) {
        Parcel p = require(trackingNumber);
        if (!partnerEmail.equals(p.getAssignedPartner()) || p.getStatus() != ParcelStatus.OUT_FOR_DELIVERY)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "not your active delivery");
        return p;
    }

    private void move(Parcel p, ParcelStatus next, Long depotId, String note) {
        if (!p.getStatus().canMoveTo(next))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "cannot move from " + p.getStatus() + " to " + next);
        p.setStatus(next);
        logEvent(p, next, depotId, note);
    }

    private void logEvent(Parcel p, ParcelStatus status, Long depotId, String note) {
        events.save(new ParcelEvent(p.getId(), status, depotId, note));
    }

    Parcel require(String trackingNumber) {
        return parcels.findByTrackingNumber(trackingNumber)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "parcel not found"));
    }

    Depot depotByCity(String city) {
        return depots.findByCityIgnoreCase(city.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "we do not serve city: " + city));
    }

    // resolve the depot a hub or partner user is scoped to, from their home city claim
    public Long depotIdForCity(String city) {
        if (city == null || city.isBlank())
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "no depot city on this account");
        return depotByCity(city).getId();
    }

    public List<DepotResponse> allDepots() {
        return depots.findAll().stream().map(DepotResponse::from).toList();
    }

    public Page<ParcelResponse> allParcels(Pageable pg) {
        return parcels.findAll(pg).map(ParcelResponse::from);
    }

    // ---- admin network view ----

    private Instant startOfTodayIst() {
        return java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))
            .atStartOfDay(java.time.ZoneId.of("Asia/Kolkata")).toInstant();
    }

    public List<DepotSummary> depotSummaries() {
        Instant today = startOfTodayIst();
        List<DepotSummary> out = new ArrayList<>();
        for (Depot d : depots.findAll()) {
            long active = parcels.countByOriginDepotIdAndStatusNot(d.getId(), ParcelStatus.DELIVERED);
            long stock = parcels.countByOriginDepotIdAndStatus(d.getId(), ParcelStatus.AT_ORIGIN_DEPOT)
                + parcels.countByDestDepotIdAndStatus(d.getId(), ParcelStatus.AT_DEST_DEPOT);
            List<Batch> outToday = batches.findByOriginDepotIdAndDepartedAtGreaterThanEqual(d.getId(), today);
            long truck = outToday.stream().filter(b -> b.getMode() == Mode.TRUCK).count();
            long train = outToday.stream().filter(b -> b.getMode() == Mode.TRAIN).count();
            out.add(new DepotSummary(d.getId(), d.getCity(), d.getLat(), d.getLng(),
                active, stock, truck, train));
        }
        return out;
    }

    public DepotDetail depotDetail(Long depotId) {
        Depot d = depots.findById(depotId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "depot not found"));
        List<ParcelResponse> active = parcels
            .findByOriginDepotIdAndStatusNot(depotId, ParcelStatus.DELIVERED)
            .stream().map(ParcelResponse::from).toList();
        List<ParcelResponse> stock = new ArrayList<>();
        parcels.findByOriginDepotIdAndStatus(depotId, ParcelStatus.AT_ORIGIN_DEPOT)
            .forEach(p -> stock.add(ParcelResponse.from(p)));
        parcels.findByDestDepotIdAndStatus(depotId, ParcelStatus.AT_DEST_DEPOT)
            .forEach(p -> stock.add(ParcelResponse.from(p)));
        List<BatchResponse> outbound = batches
            .findByOriginDepotIdAndDepartedAtGreaterThanEqual(depotId, startOfTodayIst())
            .stream().map(BatchResponse::from).toList();
        return new DepotDetail(d.getId(), d.getCity(), active, stock, outbound);
    }

    private Mode modeFor(int km) {
        return km >= TRAIN_KM ? Mode.TRAIN : Mode.TRUCK;
    }

    private int distanceKm(Depot a, Depot b) {
        return (int) Math.round(GeoMath.haversine(a.getLat(), a.getLng(), b.getLat(), b.getLng()) / 1000.0);
    }

    private Map<Long, Depot> depotMap() {
        Map<Long, Depot> m = new HashMap<>();
        depots.findAll().forEach(d -> m.put(d.getId(), d));
        return m;
    }

    private Map<Long, String> depotCityMap() {
        Map<Long, String> m = new HashMap<>();
        depots.findAll().forEach(d -> m.put(d.getId(), d.getCity()));
        return m;
    }

    private String newTrackingNumber() {
        for (int i = 0; i < 6; i++) {
            String tn = "DD" + ThreadLocalRandom.current().nextLong(10_000_000L, 100_000_000L);
            if (!parcels.existsByTrackingNumber(tn)) return tn;
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "could not allocate tracking number");
    }
}
