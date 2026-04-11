package com.daakdash.tracking;

import static org.junit.jupiter.api.Assertions.*;

import com.daakdash.tracking.model.ParcelStatus;
import org.junit.jupiter.api.Test;

class ParcelStatusTest {

    @Test
    void happyPathIsAllowedStepByStep() {
        assertTrue(ParcelStatus.BOOKED.canMoveTo(ParcelStatus.AT_ORIGIN_DEPOT));
        assertTrue(ParcelStatus.AT_ORIGIN_DEPOT.canMoveTo(ParcelStatus.SORTED));
        assertTrue(ParcelStatus.SORTED.canMoveTo(ParcelStatus.IN_TRANSIT));
        assertTrue(ParcelStatus.IN_TRANSIT.canMoveTo(ParcelStatus.AT_DEST_DEPOT));
        assertTrue(ParcelStatus.AT_DEST_DEPOT.canMoveTo(ParcelStatus.OUT_FOR_DELIVERY));
        assertTrue(ParcelStatus.OUT_FOR_DELIVERY.canMoveTo(ParcelStatus.DELIVERED));
    }

    @Test
    void skippingOrGoingBackwardsIsBlocked() {
        assertFalse(ParcelStatus.BOOKED.canMoveTo(ParcelStatus.IN_TRANSIT));
        assertFalse(ParcelStatus.DELIVERED.canMoveTo(ParcelStatus.OUT_FOR_DELIVERY));
        assertFalse(ParcelStatus.AT_ORIGIN_DEPOT.canMoveTo(ParcelStatus.AT_ORIGIN_DEPOT));
    }

    @Test
    void absentReturnsToDepotThenCanRetry() {
        assertTrue(ParcelStatus.OUT_FOR_DELIVERY.canMoveTo(ParcelStatus.RECEIVER_ABSENT));
        assertTrue(ParcelStatus.RECEIVER_ABSENT.canMoveTo(ParcelStatus.AT_DEST_DEPOT));
        assertTrue(ParcelStatus.AT_DEST_DEPOT.canMoveTo(ParcelStatus.OUT_FOR_DELIVERY));
    }
}
