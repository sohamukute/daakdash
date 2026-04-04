package com.daakdash.auth.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTtl;
    private final long refreshTtl;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-ttl-seconds}") long accessTtl,
            @Value("${app.jwt.refresh-ttl-seconds}") long refreshTtl) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
    }

    public String accessToken(String email, String role, String city) {
        return build(email, role, city, "access", accessTtl);
    }

    public String refreshToken(String email, String role, String city) {
        return build(email, role, city, "refresh", refreshTtl);
    }

    private String build(String email, String role, String city, String type, long ttlSeconds) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .subject(email)
                .claim("role", role)
                .claim("type", type)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .signWith(key);
        if (city != null && !city.isBlank()) {
            builder.claim("city", city);
        }
        return builder.compact();
    }

    public Claims parse(String token) {
        Jws<Claims> jws = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token);
        return jws.getPayload();
    }
}
