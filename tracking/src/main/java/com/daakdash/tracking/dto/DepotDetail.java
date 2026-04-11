package com.daakdash.tracking.dto;

import java.util.List;

// the drill down when the admin clicks a depot on the map
public record DepotDetail(
    Long depotId, String city,
    List<ParcelResponse> activeOrders,
    List<ParcelResponse> stock,
    List<BatchResponse> todayOutbound
) {}
