package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.Parcel;
import com.daakdash.tracking.model.ParcelStatus;

// a seller only sees whether their parcel is on the way or delivered, nothing operational.
public record SellerView(
    String trackingNumber, String itemName, int quantity,
    String receiverName, String destCity, ParcelStatus status, boolean delivered
) {
    public static SellerView from(Parcel p) {
        return new SellerView(p.getTrackingNumber(), p.getItemName(), p.getQuantity(),
            p.getReceiverName(), p.getDestCity(), p.getStatus(), p.getStatus() == ParcelStatus.DELIVERED);
    }
}
