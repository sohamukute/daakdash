package com.daakdash.tracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

// delivers the OTP to the receiver's phone over 2factor.in (their OTP route needs no DLT and
// uses a fixed template, so only the code travels). without a key the OTP is logged instead,
// keeping the flow testable.
@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    private final String apiKey;
    private final RestClient http = RestClient.create();

    public SmsService(@Value("${SMS_API_KEY:}") String apiKey) {
        this.apiKey = apiKey;
    }

    public void sendOtp(String phone, String otp, String trackingNumber) {
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        if (apiKey.isBlank()) {
            log.info("sms (provider not configured) to={} : parcel {} out for delivery, OTP {}",
                digits, trackingNumber, otp);
            return;
        }
        try {
            // the OTP1 template forces sms delivery; without a template 2factor falls back to a voice call
            String body = http.get()
                .uri("https://2factor.in/API/V1/{key}/SMS/{phone}/{otp}/OTP1", apiKey, digits, otp)
                .retrieve()
                .body(String.class);
            log.info("otp sms sent for {} to {}: {}", trackingNumber, digits, body);
        } catch (Exception e) {
            log.error("otp sms to {} failed: {}", digits, e.getMessage());
            log.info("undelivered otp for {}: {}", trackingNumber, otp);
        }
    }
}
