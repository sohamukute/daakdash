package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.ParcelStatus;
import java.time.Instant;
import java.util.List;

// public tracking: the status and the hub timeline, no PII beyond city names.
public record TrackView(
    String trackingNumber, ParcelStatus status,
    String originCity, String destCity,
    List<Step> timeline
) {
    public record Step(ParcelStatus status, String depotCity, Instant at) {}
}
