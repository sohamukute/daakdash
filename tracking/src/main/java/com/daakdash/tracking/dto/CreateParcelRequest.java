package com.daakdash.tracking.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateParcelRequest(
    @NotBlank String itemName,
    Integer quantity,
    @NotBlank String receiverName,
    @NotBlank String receiverPhone,
    @NotBlank String receiverAddress,
    @NotBlank String originCity,
    @NotBlank String destCity
) {}
