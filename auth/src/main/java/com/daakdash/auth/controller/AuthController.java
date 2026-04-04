package com.daakdash.auth.controller;

import com.daakdash.auth.dto.LoginRequest;
import com.daakdash.auth.dto.OnboardPartnerRequest;
import com.daakdash.auth.dto.OnboardResponse;
import com.daakdash.auth.dto.OnboardSellerRequest;
import com.daakdash.auth.dto.RefreshRequest;
import com.daakdash.auth.dto.TokenResponse;
import com.daakdash.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // self service signup exists only for sellers and delivery partners; credentials are
    // system issued and mailed, never returned over the wire.

    @PostMapping("/onboard/seller")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardResponse onboardSeller(@Valid @RequestBody OnboardSellerRequest request) {
        return authService.onboardSeller(request);
    }

    @PostMapping("/onboard/partner")
    @ResponseStatus(HttpStatus.CREATED)
    public OnboardResponse onboardPartner(@Valid @RequestBody OnboardPartnerRequest request) {
        return authService.onboardPartner(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.refreshToken());
    }
}
