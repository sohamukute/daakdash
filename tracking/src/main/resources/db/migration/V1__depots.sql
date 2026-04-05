-- one depot (city sorting hub) per serviced city. all sit near a railway station, so mode
-- choice is purely by distance. lat/lng drive the train vs truck decision.
create table depots (
    id    bigserial primary key,
    city  varchar(80) not null unique,
    lat   double precision not null,
    lng   double precision not null
);

insert into depots (city, lat, lng) values
    ('Mumbai',    19.0760, 72.8777),
    ('Delhi',     28.6139, 77.2090),
    ('Bengaluru', 12.9716, 77.5946),
    ('Chennai',   13.0827, 80.2707),
    ('Kolkata',   22.5726, 88.3639),
    ('Hyderabad', 17.3850, 78.4867),
    ('Ahmedabad', 23.0225, 72.5714),
    ('Pune',      18.5204, 73.8567),
    ('Jaipur',    26.9124, 75.7873),
    ('Lucknow',   26.8467, 80.9462),
    ('Nagpur',    21.1458, 79.0882),
    ('Bhopal',    23.2599, 77.4126);

-- a batch is all parcels moving together on one origin to dest lane by one mode. this is the
-- consolidation: many parcels, one truck or one train car.
create table batches (
    id              bigserial primary key,
    origin_depot_id bigint not null references depots(id),
    dest_depot_id   bigint not null references depots(id),
    mode            varchar(8)  not null,   -- TRAIN or TRUCK
    status          varchar(12) not null default 'BUILDING',  -- BUILDING, DEPARTED, ARRIVED
    departed_at     timestamptz,
    arrived_at      timestamptz,
    created_at      timestamptz not null default now()
);

create index batches_lane_idx on batches (origin_depot_id, dest_depot_id, status);

create table parcels (
    id               bigserial primary key,
    tracking_number  varchar(20)  not null unique,
    seller_email     varchar(160) not null,
    item_name        varchar(200) not null,
    quantity         int not null default 1,
    receiver_name    varchar(160) not null,
    receiver_phone   varchar(32)  not null,
    receiver_address varchar(400) not null,
    origin_city      varchar(80)  not null,
    dest_city        varchar(80)  not null,
    origin_depot_id  bigint not null references depots(id),
    dest_depot_id    bigint not null references depots(id),
    status           varchar(24)  not null default 'BOOKED',
    otp              varchar(6)   not null,
    batch_id         bigint references batches(id),
    assigned_partner varchar(160),
    absent_until     timestamptz,
    version          int not null default 0,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index parcels_seller_idx on parcels (seller_email);
create index parcels_status_idx on parcels (status);
create index parcels_origin_idx on parcels (origin_depot_id, status);
create index parcels_dest_idx   on parcels (dest_depot_id, status);
create index parcels_partner_idx on parcels (assigned_partner, status);

-- the tracking timeline: one row per hub event, newest last
create table parcel_events (
    id          bigserial primary key,
    parcel_id   bigint not null references parcels(id),
    status      varchar(24) not null,
    depot_id    bigint,
    note        varchar(240),
    created_at  timestamptz not null default now()
);

create index parcel_events_parcel_idx on parcel_events (parcel_id, created_at);
