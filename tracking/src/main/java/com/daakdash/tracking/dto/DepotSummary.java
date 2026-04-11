package com.daakdash.tracking.dto;

// one map pin on the admin's network view
public record DepotSummary(
    Long depotId, String city, double lat, double lng,
    long activeOrders, long stockAtDepot,
    long todayOutTruck, long todayOutTrain
) {}
