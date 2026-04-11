package com.daakdash.tracking.repository;

import com.daakdash.tracking.model.Depot;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepotRepository extends JpaRepository<Depot, Long> {
    Optional<Depot> findByCityIgnoreCase(String city);
}
