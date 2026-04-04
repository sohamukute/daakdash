package com.daakdash.auth.dto;

import java.time.Instant;

// what the admin sees in the sellers directory
public record SellerInfo(
    String businessName, String gstNumber, String address,
    String contactEmail, String phone, String loginEmail, Instant onboardedAt
) {}
