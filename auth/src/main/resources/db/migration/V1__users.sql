create table users (
    id            bigserial primary key,
    email         varchar(255) not null unique,
    password_hash varchar(255) not null,
    role          varchar(32)  not null,
    home_city     varchar(80),
    name          varchar(160),
    gst_number    varchar(15),
    address       varchar(400),
    contact_email varchar(160),
    phone         varchar(32),
    created_at    timestamptz  not null default now()
);

-- Seeded demo password is 'password'. The admin password is overwritten from
-- ADMIN_PASSWORD on application boot when that environment variable is set.
insert into users (email, password_hash, role, home_city) values
    ('admin@daakdash.in',        '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'ADMIN', null),
    ('hub.mumbai@daakdash.in',   '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Mumbai'),
    ('hub.delhi@daakdash.in',    '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Delhi'),
    ('hub.bengaluru@daakdash.in','$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Bengaluru'),
    ('hub.chennai@daakdash.in',  '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Chennai'),
    ('hub.kolkata@daakdash.in',  '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Kolkata'),
    ('hub.hyderabad@daakdash.in','$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Hyderabad'),
    ('hub.ahmedabad@daakdash.in','$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Ahmedabad'),
    ('hub.pune@daakdash.in',     '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Pune'),
    ('hub.jaipur@daakdash.in',   '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Jaipur'),
    ('hub.lucknow@daakdash.in',  '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Lucknow'),
    ('hub.nagpur@daakdash.in',   '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Nagpur'),
    ('hub.bhopal@daakdash.in',   '$2b$10$BH6RVOSv8mNWIQ5Pxi6Vo.gz73.oIgy9Nf3xegTYpHuWBoPlo081C', 'HUB', 'Bhopal');
