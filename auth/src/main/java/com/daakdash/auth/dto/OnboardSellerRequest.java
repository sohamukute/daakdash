package com.daakdash.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OnboardSellerRequest(
        @NotBlank String businessName,
        @NotBlank @Size(min = 15, max = 15) String gstNumber,
        @NotBlank String address,
        @NotBlank @Email String contactEmail,
        @NotBlank String phone
) {
}
