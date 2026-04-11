package com.daakdash.tracking.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "batches")
public class Batch {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "origin_depot_id", nullable = false) private Long originDepotId;
    @Column(name = "dest_depot_id", nullable = false) private Long destDepotId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false) private Mode mode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false) private BatchStatus status = BatchStatus.BUILDING;

    @Column(name = "departed_at") private Instant departedAt;
    @Column(name = "arrived_at") private Instant arrivedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();

    protected Batch() {}

    public Batch(Long originDepotId, Long destDepotId, Mode mode) {
        this.originDepotId = originDepotId;
        this.destDepotId = destDepotId;
        this.mode = mode;
    }

    public void depart() { this.status = BatchStatus.DEPARTED; this.departedAt = Instant.now(); }
    public void arrive() { this.status = BatchStatus.ARRIVED; this.arrivedAt = Instant.now(); }

    public Long getId() { return id; }
    public Long getOriginDepotId() { return originDepotId; }
    public Long getDestDepotId() { return destDepotId; }
    public Mode getMode() { return mode; }
    public BatchStatus getStatus() { return status; }
    public Instant getDepartedAt() { return departedAt; }
    public Instant getArrivedAt() { return arrivedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
