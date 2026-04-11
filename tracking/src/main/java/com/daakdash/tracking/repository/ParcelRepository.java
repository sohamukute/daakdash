package com.daakdash.tracking.repository;

import com.daakdash.tracking.model.Parcel;
import com.daakdash.tracking.model.ParcelStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParcelRepository extends JpaRepository<Parcel, Long> {

    Optional<Parcel> findByTrackingNumber(String trackingNumber);
    boolean existsByTrackingNumber(String trackingNumber);

    Page<Parcel> findBySellerEmailOrderByCreatedAtDesc(String sellerEmail, Pageable p);

    // depot operator views, scoped to their city depot
    List<Parcel> findByOriginDepotIdAndStatus(Long originDepotId, ParcelStatus status);
    List<Parcel> findByDestDepotIdAndStatus(Long destDepotId, ParcelStatus status);

    // a batch's parcels
    List<Parcel> findByBatchId(Long batchId);

    // parcels waiting at a dest depot for a partner to pick up
    List<Parcel> findByDestDepotIdAndStatusOrderByUpdatedAtAsc(Long destDepotId, ParcelStatus status);

    // a partner's active load
    List<Parcel> findByAssignedPartnerAndStatus(String assignedPartner, ParcelStatus status);
    long countByAssignedPartnerAndStatus(String assignedPartner, ParcelStatus status);

    // admin depot summary counters
    long countByOriginDepotIdAndStatusNot(Long originDepotId, ParcelStatus status);
    long countByOriginDepotIdAndStatus(Long originDepotId, ParcelStatus status);
    long countByDestDepotIdAndStatus(Long destDepotId, ParcelStatus status);
    List<Parcel> findByOriginDepotIdAndStatusNot(Long originDepotId, ParcelStatus status);
}
