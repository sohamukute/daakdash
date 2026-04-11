package com.daakdash.tracking.repository;

import com.daakdash.tracking.model.Batch;
import com.daakdash.tracking.model.BatchStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BatchRepository extends JpaRepository<Batch, Long> {
    List<Batch> findByOriginDepotIdAndStatus(Long originDepotId, BatchStatus status);
    List<Batch> findByDestDepotIdAndStatus(Long destDepotId, BatchStatus status);
    List<Batch> findByOriginDepotIdAndDepartedAtGreaterThanEqual(Long originDepotId, java.time.Instant since);
}
