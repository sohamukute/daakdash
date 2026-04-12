package com.daakdash.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    // open paths skip the token check: login/register and public parcel tracking, plus actuator
    private static final List<String> OPEN = List.of(
            "/api/auth/", "/api/track/", "/api/depots", "/actuator/");

    private final SecretKey key;

    public JwtAuthFilter(@Value("${app.jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        // always strip any client supplied identity headers so they cannot be spoofed
        ServerHttpRequest stripped = exchange.getRequest().mutate()
                .headers(h -> {
                    h.remove("X-User-Email");
                    h.remove("X-User-Role");
                    h.remove("X-User-City");
                })
                .build();

        if (OPEN.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange.mutate().request(stripped).build());
        }

        String header = stripped.getHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return reject(exchange);
        }
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(header.substring(7))
                    .getPayload();
            if (!"access".equals(claims.get("type", String.class))) {
                return reject(exchange);
            }
            // hand the verified identity to the services behind the gateway
            String city = claims.get("city", String.class);
            var builder = stripped.mutate()
                    .header("X-User-Email", claims.getSubject())
                    .header("X-User-Role", claims.get("role", String.class));
            if (city != null && !city.isBlank()) {
                builder.header("X-User-City", city);
            }
            ServerHttpRequest forwarded = builder.build();
            return chain.filter(exchange.mutate().request(forwarded).build());
        } catch (JwtException e) {
            return reject(exchange);
        }
    }

    private Mono<Void> reject(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
