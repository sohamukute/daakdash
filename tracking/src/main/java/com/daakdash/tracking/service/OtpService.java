package com.daakdash.tracking.service;

import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;

// a delivery OTP is a 6 digit code the receiver reads out and the partner types to confirm
// handover. stored on the parcel; in a real system it would be texted to the receiver.
@Service
public class OtpService {
    public String generate() {
        return String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
    }
}
