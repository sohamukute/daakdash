package com.daakdash.auth.dto;

public record TokenResponse(
        String accessToken,
        String refreshToken
) {
}
