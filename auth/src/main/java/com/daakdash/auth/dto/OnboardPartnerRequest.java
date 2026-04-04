package com.daakdash.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record OnboardPartnerRequest(
        @NotBlank String name,
        @NotBlank @Email String personalEmail,
        @NotBlank String phone,
        @NotBlank String homeCity
) {
}
