package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.Parcel;
import com.daakdash.tracking.model.ParcelStatus;
import java.time.Instant;

public record ParcelResponse(
    Long id, String trackingNumber, String sellerEmail,
    String itemName, int quantity,
    String receiverName, String receiverPhone, String receiverAddress,
    String originCity, String destCity, Long originDepotId, Long destDepotId,
    ParcelStatus status, Long batchId, String assignedPartner,
    Instant createdAt, Instant updatedAt
) {
    public static ParcelResponse from(Parcel p) {
        return new ParcelResponse(
            p.getId(), p.getTrackingNumber(), p.getSellerEmail(),
            p.getItemName(), p.getQuantity(),
            p.getReceiverName(), p.getReceiverPhone(), p.getReceiverAddress(),
            p.getOriginCity(), p.getDestCity(), p.getOriginDepotId(), p.getDestDepotId(),
            p.getStatus(), p.getBatchId(), p.getAssignedPartner(),
            p.getCreatedAt(), p.getUpdatedAt());
    }
}
