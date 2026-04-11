package com.daakdash.tracking.repository;

import com.daakdash.tracking.model.ParcelEvent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParcelEventRepository extends JpaRepository<ParcelEvent, Long> {
    List<ParcelEvent> findByParcelIdOrderByCreatedAtAsc(Long parcelId);
}
