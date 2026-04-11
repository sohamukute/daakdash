package com.daakdash.tracking.controller;

import com.daakdash.tracking.dto.*;
import com.daakdash.tracking.service.ParcelService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

// the city depot operator. every action is scoped to the depot of the operator's home city,
// taken from the X-User-City claim the gateway injects. a HUB user cannot touch another city.
@RestController
@RequestMapping("/api/depot")
public class DepotController {

    private final ParcelService parcels;

    public DepotController(ParcelService parcels) { this.parcels = parcels; }

    @GetMapping("/inbound")
    public List<ParcelResponse> inbound(@RequestHeader(value = "X-User-Role", required = false) String role,
                                        @RequestHeader(value = "X-User-City", required = false) String city) {
        return parcels.inboundAtOrigin(depot(role, city));
    }

    @PostMapping("/scan-in")
    public void scanIn(@RequestHeader(value = "X-User-Role", required = false) String role,
                       @RequestHeader(value = "X-User-City", required = false) String city,
                       @RequestBody Map<String, String> body) {
        parcels.scanInAtOrigin(depot(role, city), body.get("trackingNumber"));
    }

    @GetMapping("/lanes")
    public List<LaneGroup> lanes(@RequestHeader(value = "X-User-Role", required = false) String role,
                                 @RequestHeader(value = "X-User-City", required = false) String city) {
        return parcels.lanes(depot(role, city));
    }

    @PostMapping("/dispatch")
    public Map<String, Integer> dispatch(@RequestHeader(value = "X-User-Role", required = false) String role,
                                         @RequestHeader(value = "X-User-City", required = false) String city,
                                         @RequestBody Map<String, Long> body) {
        int n = parcels.dispatchLane(depot(role, city), body.get("destDepotId"));
        return Map.of("dispatched", n);
    }

    @GetMapping("/inbound-batches")
    public List<BatchResponse> inboundBatches(@RequestHeader(value = "X-User-Role", required = false) String role,
                                              @RequestHeader(value = "X-User-City", required = false) String city) {
        return parcels.inboundBatches(depot(role, city));
    }

    @GetMapping("/waiting")
    public List<ParcelResponse> waiting(@RequestHeader(value = "X-User-Role", required = false) String role,
                                        @RequestHeader(value = "X-User-City", required = false) String city) {
        return parcels.waitingAtDest(depot(role, city));
    }

    @PostMapping("/arrive")
    public Map<String, Integer> arrive(@RequestHeader(value = "X-User-Role", required = false) String role,
                                       @RequestHeader(value = "X-User-City", required = false) String city,
                                       @RequestBody Map<String, Long> body) {
        int n = parcels.arriveBatch(depot(role, city), body.get("batchId"));
        return Map.of("arrived", n);
    }

    private Long depot(String role, String city) {
        if (!"HUB".equals(role) && !"ADMIN".equals(role))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return parcels.depotIdForCity(city);
    }
}
