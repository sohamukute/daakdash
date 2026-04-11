package com.daakdash.tracking.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "parcel_events")
public class ParcelEvent {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "parcel_id", nullable = false) private Long parcelId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false) private ParcelStatus status;

    @Column(name = "depot_id") private Long depotId;
    private String note;

    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

    protected ParcelEvent() {}

    public ParcelEvent(Long parcelId, ParcelStatus status, Long depotId, String note) {
        this.parcelId = parcelId;
        this.status = status;
        this.depotId = depotId;
        this.note = note;
    }

    public Long getId() { return id; }
    public Long getParcelId() { return parcelId; }
    public ParcelStatus getStatus() { return status; }
    public Long getDepotId() { return depotId; }
    public String getNote() { return note; }
    public Instant getCreatedAt() { return createdAt; }
}
