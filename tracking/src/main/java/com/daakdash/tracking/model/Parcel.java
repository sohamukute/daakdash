package com.daakdash.tracking.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "parcels")
public class Parcel {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tracking_number", nullable = false, unique = true)
    private String trackingNumber;

    @Column(name = "seller_email", nullable = false)
    private String sellerEmail;

    @Column(name = "item_name", nullable = false) private String itemName;
    @Column(nullable = false) private int quantity = 1;

    @Column(name = "receiver_name", nullable = false) private String receiverName;
    @Column(name = "receiver_phone", nullable = false) private String receiverPhone;
    @Column(name = "receiver_address", nullable = false) private String receiverAddress;

    @Column(name = "origin_city", nullable = false) private String originCity;
    @Column(name = "dest_city", nullable = false) private String destCity;
    @Column(name = "origin_depot_id", nullable = false) private Long originDepotId;
    @Column(name = "dest_depot_id", nullable = false) private Long destDepotId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ParcelStatus status = ParcelStatus.BOOKED;

    @Column(nullable = false) private String otp;
    @Column(name = "batch_id") private Long batchId;
    @Column(name = "assigned_partner") private String assignedPartner;
    @Column(name = "absent_until") private Instant absentUntil;

    @Version private Integer version;

    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

    protected Parcel() {}

    public Parcel(String trackingNumber, String sellerEmail, String itemName, int quantity,
                  String receiverName, String receiverPhone, String receiverAddress,
                  String originCity, String destCity, Long originDepotId, Long destDepotId, String otp) {
        this.trackingNumber = trackingNumber;
        this.sellerEmail = sellerEmail;
        this.itemName = itemName;
        this.quantity = quantity;
        this.receiverName = receiverName;
        this.receiverPhone = receiverPhone;
        this.receiverAddress = receiverAddress;
        this.originCity = originCity;
        this.destCity = destCity;
        this.originDepotId = originDepotId;
        this.destDepotId = destDepotId;
        this.otp = otp;
    }

    private void touch() { this.updatedAt = Instant.now(); }

    public void setStatus(ParcelStatus status) { this.status = status; touch(); }
    public void setBatchId(Long batchId) { this.batchId = batchId; touch(); }
    public void setAssignedPartner(String partner) { this.assignedPartner = partner; touch(); }
    public void setAbsentUntil(Instant t) { this.absentUntil = t; touch(); }

    public Long getId() { return id; }
    public String getTrackingNumber() { return trackingNumber; }
    public String getSellerEmail() { return sellerEmail; }
    public String getItemName() { return itemName; }
    public int getQuantity() { return quantity; }
    public String getReceiverName() { return receiverName; }
    public String getReceiverPhone() { return receiverPhone; }
    public String getReceiverAddress() { return receiverAddress; }
    public String getOriginCity() { return originCity; }
    public String getDestCity() { return destCity; }
    public Long getOriginDepotId() { return originDepotId; }
    public Long getDestDepotId() { return destDepotId; }
    public ParcelStatus getStatus() { return status; }
    public String getOtp() { return otp; }
    public Long getBatchId() { return batchId; }
    public String getAssignedPartner() { return assignedPartner; }
    public Instant getAbsentUntil() { return absentUntil; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
