package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.Depot;

public record DepotResponse(Long id, String city, double lat, double lng) {
    public static DepotResponse from(Depot d) {
        return new DepotResponse(d.getId(), d.getCity(), d.getLat(), d.getLng());
    }
}
