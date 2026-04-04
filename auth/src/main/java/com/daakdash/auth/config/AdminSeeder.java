package com.daakdash.auth.config;

import com.daakdash.auth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// the admin password lives in the environment (.env), not in a committed migration. every
// boot re-applies it, so rotating the password is: change .env, restart auth.
@Component
public class AdminSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminSeeder.class);
    private static final String ADMIN_EMAIL = "admin@daakdash.in";

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String adminPassword;

    public AdminSeeder(UserRepository users, PasswordEncoder encoder,
                       @Value("${ADMIN_PASSWORD:}") String adminPassword) {
        this.users = users;
        this.encoder = encoder;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (adminPassword.isBlank()) {
            log.warn("ADMIN_PASSWORD not set; admin password left unchanged");
            return;
        }
        users.findByEmail(ADMIN_EMAIL).ifPresent(u -> {
            u.setPasswordHash(encoder.encode(adminPassword));
            users.save(u);
            log.info("admin password applied from environment");
        });
    }
}
