package com.daakdash.tracking.model;

import jakarta.persistence.*;

@Entity
@Table(name = "depots")
public class Depot {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String city;

    private double lat;
    private double lng;

    protected Depot() {}

    public Long getId() { return id; }
    public String getCity() { return city; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
}
