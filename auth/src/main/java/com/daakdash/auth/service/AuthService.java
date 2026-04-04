package com.daakdash.auth.service;

import com.daakdash.auth.config.JwtService;
import com.daakdash.auth.dto.LoginRequest;
import com.daakdash.auth.dto.OnboardPartnerRequest;
import com.daakdash.auth.dto.OnboardResponse;
import com.daakdash.auth.dto.OnboardSellerRequest;
import com.daakdash.auth.dto.TokenResponse;
import com.daakdash.auth.model.Role;
import com.daakdash.auth.model.User;
import com.daakdash.auth.repository.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.security.SecureRandom;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private static final String ALPHABET =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final MailService mail;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder,
                       JwtService jwtService, MailService mail) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.mail = mail;
    }

    // sellers and partners never pick their own login. the system issues a uniform one and
    // mails the credentials to the address they gave us.

    public OnboardResponse onboardSeller(OnboardSellerRequest r) {
        String login = uniqueLogin("seller");
        String password = randomPassword();
        User u = new User(login, passwordEncoder.encode(password), Role.SELLER);
        u.setName(r.businessName());
        u.setGstNumber(r.gstNumber().toUpperCase());
        u.setAddress(r.address());
        u.setContactEmail(r.contactEmail());
        u.setPhone(r.phone());
        users.save(u);
        mail.send(r.contactEmail(), "Your DaakDash seller account",
            "Namaste " + r.businessName() + ",\n\n"
            + "Your DaakDash seller account is ready.\n\n"
            + "Login: " + login + "\nPassword: " + password + "\n\n"
            + "Sign in at the DaakDash portal, book your parcels, and drop them at your city depot.\n"
            + "Please change nothing in this mail and keep it safe.\n\n- DaakDash");
        return new OnboardResponse(login, "credentials sent to " + r.contactEmail());
    }

    public OnboardResponse onboardPartner(OnboardPartnerRequest r) {
        String login = uniqueLogin("partner");
        String password = randomPassword();
        User u = new User(login, passwordEncoder.encode(password), Role.PARTNER);
        u.setName(r.name());
        u.setContactEmail(r.personalEmail());
        u.setPhone(r.phone());
        // city validated only as non blank here; a wrong city surfaces as a clear
        // 400 from the depot service on first go-online. cross service validation if it hurts.
        u.setHomeCity(r.homeCity().trim());
        users.save(u);
        mail.send(r.personalEmail(), "Your DaakDash delivery partner account",
            "Namaste " + r.name() + ",\n\n"
            + "Welcome to the DaakDash delivery fleet (" + u.getHomeCity() + ").\n\n"
            + "Login: " + login + "\nPassword: " + password + "\n\n"
            + "Sign in, go online, and deliveries from your city depot will be assigned to you.\n\n- DaakDash");
        return new OnboardResponse(login, "credentials sent to " + r.personalEmail());
    }

    public TokenResponse login(LoginRequest request) {
        User user = users.findByEmail(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "bad credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "bad credentials");
        }
        return tokensFor(user);
    }

    public TokenResponse refresh(String refreshToken) {
        Claims claims;
        try {
            claims = jwtService.parse(refreshToken);
        } catch (JwtException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid refresh token");
        }
        if (!"refresh".equals(claims.get("type", String.class))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "not a refresh token");
        }
        User user = users.findByEmail(claims.getSubject())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "user gone"));
        return tokensFor(user);
    }

    private TokenResponse tokensFor(User user) {
        String role = user.getRole().name();
        String city = user.getHomeCity();
        return new TokenResponse(
                jwtService.accessToken(user.getEmail(), role, city),
                jwtService.refreshToken(user.getEmail(), role, city));
    }

    private String uniqueLogin(String prefix) {
        for (int i = 0; i < 8; i++) {
            String candidate = prefix + String.format("%06d", random.nextInt(1_000_000)) + "@daakdash.in";
            if (!users.existsByEmail(candidate)) {
                return candidate;
            }
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "could not allocate a login, try again");
    }

    private String randomPassword() {
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
