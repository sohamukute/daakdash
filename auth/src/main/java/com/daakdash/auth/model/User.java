package com.daakdash.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // the system issued login, e.g. seller483920@daakdash.in
    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // the city a HUB operator or PARTNER is scoped to. null for SELLER and ADMIN.
    @Column(name = "home_city")
    private String homeCity;

    // onboarding details: business or person name, GST for sellers, and where to reach them
    private String name;
    @Column(name = "gst_number") private String gstNumber;
    private String address;
    @Column(name = "contact_email") private String contactEmail;
    private String phone;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected User() {
    }

    public User(String email, String passwordHash, Role role) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public String getHomeCity() { return homeCity; }
    public String getName() { return name; }
    public String getGstNumber() { return gstNumber; }
    public String getAddress() { return address; }
    public String getContactEmail() { return contactEmail; }
    public String getPhone() { return phone; }
    public Instant getCreatedAt() { return createdAt; }

    public void setHomeCity(String homeCity) { this.homeCity = homeCity; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setName(String name) { this.name = name; }
    public void setGstNumber(String gstNumber) { this.gstNumber = gstNumber; }
    public void setAddress(String address) { this.address = address; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public void setPhone(String phone) { this.phone = phone; }
}
