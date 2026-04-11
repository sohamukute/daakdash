package com.daakdash.tracking.model;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum ParcelStatus {
    BOOKED,
    AT_ORIGIN_DEPOT,
    SORTED,
    IN_TRANSIT,
    AT_DEST_DEPOT,
    OUT_FOR_DELIVERY,
    DELIVERED,
    RECEIVER_ABSENT;

    // the moves allowed out of each state. delivered is terminal.
    private static final Map<ParcelStatus, Set<ParcelStatus>> NEXT = Map.of(
        BOOKED,           EnumSet.of(AT_ORIGIN_DEPOT),
        AT_ORIGIN_DEPOT,  EnumSet.of(SORTED),
        SORTED,           EnumSet.of(IN_TRANSIT),
        IN_TRANSIT,       EnumSet.of(AT_DEST_DEPOT),
        AT_DEST_DEPOT,    EnumSet.of(OUT_FOR_DELIVERY),
        OUT_FOR_DELIVERY, EnumSet.of(DELIVERED, RECEIVER_ABSENT),
        RECEIVER_ABSENT,  EnumSet.of(AT_DEST_DEPOT),
        DELIVERED,        EnumSet.noneOf(ParcelStatus.class)
    );

    public boolean isTerminal() {
        return this == DELIVERED;
    }

    public boolean canMoveTo(ParcelStatus next) {
        if (next == null || this == next) return false;
        return NEXT.get(this).contains(next);
    }
}
