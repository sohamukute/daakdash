package com.daakdash.tracking.controller;

import com.daakdash.tracking.dto.DepotResponse;
import com.daakdash.tracking.dto.TrackView;
import com.daakdash.tracking.service.ParcelService;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
public class TrackController {

    private final ParcelService parcels;

    public TrackController(ParcelService parcels) { this.parcels = parcels; }

    // public: anyone with the tracking number sees the hub timeline
    @GetMapping("/api/track/{trackingNumber}")
    public TrackView track(@PathVariable String trackingNumber) {
        return parcels.track(trackingNumber);
    }

    // the serviced city list, used by the seller booking form and registration
    @GetMapping("/api/depots")
    public List<DepotResponse> depots() {
        return parcels.allDepots();
    }
}
