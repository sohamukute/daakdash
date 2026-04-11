package com.daakdash.tracking.controller;

import com.daakdash.tracking.dto.*;
import com.daakdash.tracking.service.ParcelService;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/parcels")
public class SellerController {

    private final ParcelService parcels;

    public SellerController(ParcelService parcels) { this.parcels = parcels; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ParcelResponse create(@RequestHeader(value = "X-User-Email", required = false) String email,
                                 @Valid @RequestBody CreateParcelRequest req) {
        requireAuth(email);
        return parcels.create(email, req);
    }

    @PostMapping("/bulk")
    public BulkResult bulk(@RequestHeader(value = "X-User-Email", required = false) String email,
                           @RequestBody Map<String, List<CreateParcelRequest>> body) {
        requireAuth(email);
        List<CreateParcelRequest> rows = body.getOrDefault("parcels", List.of());
        var results = new ArrayList<BulkResult.Row>();
        int created = 0, failed = 0;
        for (int i = 0; i < rows.size(); i++) {
            try {
                var r = parcels.create(email, rows.get(i));
                results.add(new BulkResult.Row(i, r.trackingNumber(), null));
                created++;
            } catch (Exception ex) {
                results.add(new BulkResult.Row(i, null, ex.getMessage()));
                failed++;
            }
        }
        return new BulkResult(created, failed, results);
    }

    @GetMapping
    public Page<SellerView> mine(@RequestHeader(value = "X-User-Email", required = false) String email,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "50") int size) {
        requireAuth(email);
        return parcels.listForSeller(email, PageRequest.of(page, Math.min(size, 200)));
    }

    private static void requireAuth(String email) {
        if (email == null || email.isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
}
