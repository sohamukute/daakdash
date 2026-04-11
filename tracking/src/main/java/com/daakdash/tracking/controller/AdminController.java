package com.daakdash.tracking.controller;

import com.daakdash.tracking.dto.ParcelResponse;
import com.daakdash.tracking.service.ParcelService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ParcelService parcels;

    public AdminController(ParcelService parcels) { this.parcels = parcels; }

    @GetMapping("/parcels")
    public Page<ParcelResponse> allParcels(@RequestHeader(value = "X-User-Role", required = false) String role,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "50") int size) {
        requireAdmin(role);
        return parcels.allParcels(PageRequest.of(page, Math.min(size, 200)));
    }

    @GetMapping("/depots/summary")
    public java.util.List<com.daakdash.tracking.dto.DepotSummary> depotSummaries(
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        requireAdmin(role);
        return parcels.depotSummaries();
    }

    @GetMapping("/depot/{id}")
    public com.daakdash.tracking.dto.DepotDetail depotDetail(
            @RequestHeader(value = "X-User-Role", required = false) String role,
            @org.springframework.web.bind.annotation.PathVariable Long id) {
        requireAdmin(role);
        return parcels.depotDetail(id);
    }

    private static void requireAdmin(String role) {
        if (!"ADMIN".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
}
