package com.daakdash.tracking.dto;

import com.daakdash.tracking.model.Batch;
import com.daakdash.tracking.model.BatchStatus;
import com.daakdash.tracking.model.Mode;
import java.time.Instant;

public record BatchResponse(
    Long id, Long originDepotId, Long destDepotId, Mode mode,
    BatchStatus status, Instant departedAt, Instant arrivedAt
) {
    public static BatchResponse from(Batch b) {
        return new BatchResponse(b.getId(), b.getOriginDepotId(), b.getDestDepotId(),
            b.getMode(), b.getStatus(), b.getDepartedAt(), b.getArrivedAt());
    }
}
