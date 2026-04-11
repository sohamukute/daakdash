package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.Mode;

// parcels sitting at a depot, grouped by destination, ready to dispatch as one batch.
public record LaneGroup(
    Long destDepotId, String destCity, Mode mode, int distanceKm, int parcelCount
) {}
