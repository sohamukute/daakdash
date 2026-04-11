package com.daakdash.tracking.controller;

import com.daakdash.tracking.dto.PartnerView;
import com.daakdash.tracking.service.ParcelService;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/partner")
public class PartnerController {

    private final ParcelService parcels;

    public PartnerController(ParcelService parcels) { this.parcels = parcels; }

    @PostMapping("/online")
    public Map<String, Integer> online(@RequestHeader(value = "X-User-Email", required = false) String email,
                                       @RequestHeader(value = "X-User-Role", required = false) String role,
                                       @RequestHeader(value = "X-User-City", required = false) String city) {
        require(email, role);
        int n = parcels.goOnline(email, parcels.depotIdForCity(city));
        return Map.of("assigned", n);
    }

    @PostMapping("/offline")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void offline(@RequestHeader(value = "X-User-Email", required = false) String email,
                        @RequestHeader(value = "X-User-Role", required = false) String role) {
        require(email, role);
        parcels.requireCanGoOffline(email);
    }

    @GetMapping("/load")
    public List<PartnerView> load(@RequestHeader(value = "X-User-Email", required = false) String email,
                                  @RequestHeader(value = "X-User-Role", required = false) String role) {
        require(email, role);
        return parcels.partnerLoad(email);
    }

    @PostMapping("/send-otp")
    public void sendOtp(@RequestHeader(value = "X-User-Email", required = false) String email,
                        @RequestHeader(value = "X-User-Role", required = false) String role,
                        @RequestBody Map<String, String> body) {
        require(email, role);
        parcels.sendDeliveryOtp(email, body.get("trackingNumber"));
    }

    @PostMapping("/deliver")
    public void deliver(@RequestHeader(value = "X-User-Email", required = false) String email,
                        @RequestHeader(value = "X-User-Role", required = false) String role,
                        @RequestBody Map<String, String> body) {
        require(email, role);
        parcels.deliver(email, body.get("trackingNumber"), body.get("otp"));
    }

    @PostMapping("/absent")
    public void absent(@RequestHeader(value = "X-User-Email", required = false) String email,
                       @RequestHeader(value = "X-User-Role", required = false) String role,
                       @RequestBody Map<String, String> body) {
        require(email, role);
        parcels.markAbsent(email, body.get("trackingNumber"));
    }

    private static void require(String email, String role) {
        if (email == null || email.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!"PARTNER".equals(role) && !"ADMIN".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
}
