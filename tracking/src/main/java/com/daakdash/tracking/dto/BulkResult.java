package com.daakdash.tracking.dto;

import java.util.List;

public record BulkResult(int created, int failed, List<Row> results) {
    public record Row(int row, String trackingNumber, String error) {}
}
