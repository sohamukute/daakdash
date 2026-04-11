package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.Parcel;

// what a delivery partner sees for an active delivery. no OTP here, the partner enters it.
public record PartnerView(
    String trackingNumber, String itemName, int quantity,
    String receiverName, String receiverPhone, String receiverAddress, String destCity
) {
    public static PartnerView from(Parcel p) {
        return new PartnerView(p.getTrackingNumber(), p.getItemName(), p.getQuantity(),
            p.getReceiverName(), p.getReceiverPhone(), p.getReceiverAddress(), p.getDestCity());
    }
}
