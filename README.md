# DaakDash

A depot to door parcel courier for India, built as one clean backend project I could
actually finish. Sellers drop parcels at the depot in their city, we sort and batch them
by destination, long lanes go by train and short ones by truck, and a delivery partner
takes them the last mile with an OTP handover. The name comes from daak, the old postal
relay, plus dash. Purani daak, nayi raftaar.

## How it works

```
seller drops parcel          line haul (batched)           partner delivers
      |                            |                             |
      v                            v                             v
 [origin depot] --sort--> [TRAIN if >= 250 km] --> [dest depot] --> door + OTP call
                          [TRUCK if nearer   ]
```

- One depot per serviced city (12 cities seeded), every depot sits near a railway.
- We never pick up. The seller brings parcels to the depot. That keeps the model honest
  and the first mile free.
- All parcels on the same origin to destination lane ride together as one batch. That is
  the whole cost story of a 3PL: one truck, many parcels.
- Delivery is confirmed by an OTP. The partner presses "send OTP" at the doorstep, the
  receiver gets an automated call with the code, the partner types it in.

## Services

| service  | port | job |
|----------|------|-----|
| gateway  | 8080 | JWT check at the edge, rate limit, injects trusted X-User headers |
| auth     | 8081 | login, refresh, onboarding, credential mails via Gmail SMTP |
| tracking | 8082 | depots, parcels, batches, partner flow, OTP call via 2factor.in |
| frontend | 5173 (dev) | React + Vite + Tailwind, multilingual (en, hi, mr, ta, bn, te) |

Plus postgres (two databases, Flyway migrations) and redis (gateway rate limit).
Prometheus and Grafana ship behind a compose profile.

## Roles

- **admin** sees the whole network: a map of India with every depot pinned, click a depot
  for active orders, stock inside, and what left today by truck or train. The seeded
  password is overwritten from `ADMIN_PASSWORD` on boot.
- **seller** is onboarded with business name, GST number, address, contact email and
  phone. The system issues a uniform login (seller123456@daakdash.in) and mails the
  credentials. Sellers book single parcels or paste a CSV backlog.
- **city depot operator** is scoped to one city. Scans in dropped parcels, dispatches
  lanes (mode picked automatically by distance), receives inbound batches.
- **delivery partner** is scoped to one city too. Goes online, gets up to 12 parcels,
  cannot go offline until they are delivered. Send OTP at the door, deliver or mark the
  receiver absent (retry after 3 days).

Recipients never log in. They track by number on a public page with the depot timeline.

## Parcel lifecycle

BOOKED -> AT_ORIGIN_DEPOT -> SORTED -> IN_TRANSIT -> AT_DEST_DEPOT -> OUT_FOR_DELIVERY
-> DELIVERED, with RECEIVER_ABSENT looping back to the destination depot. The transitions
are guarded in one place and the parcel row carries a version column, so two operators
racing the same parcel produce one winner and one clean conflict instead of a silent
overwrite.

## Run it

```bash
cp .env.example .env        # fill in ADMIN_PASSWORD, JWT_SECRET, mail + sms keys
docker compose up -d --build
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Without mail or SMS keys everything still works: the credential mail and the OTP are
written to the service logs instead, so you can test the full flow on a laptop.

Migrations are squashed to one `V1` file per service. If your local Postgres volume
already ran the older `V2`, `V3`, or later migrations, use a fresh database volume before
starting the services again.

Depot operator logins are seeded for every city as `hub.<city>@daakdash.in`
(`hub.mumbai@daakdash.in`, `hub.bengaluru@daakdash.in`, and so on). The seeded
hub password is `password`. Sellers and partners are created through the onboarding
forms on the login page.

## Tests

```bash
mvn -f tracking/pom.xml test
```

Testcontainers spins up a real Postgres for the repository tests. The state machine has
its own unit test. Frontend is typechecked with tsc.

## Known issues / TODO

- Test coverage got thin during the domain rework. The lifecycle and repositories are
  covered, the service layer needs more.
- The OTP arrives as a voice call, not an SMS. 2factor trial accounts only do calls;
  real SMS in India needs a paid DLT route.
- A partner picking a wrong home city only finds out on first go-online. Validating the
  city at onboarding needs a call between auth and tracking that I have not added.
- Batch dispatch trusts the operator to press the button. No auto dispatch on a
  schedule or a fill threshold yet.
- No pagination on the depot console lists. Fine for a demo, not for a real depot day.

## Reading that shaped this

- https://www.logos3pl.com/newsletter/the-difference-between-first-mile-middle-mile-last-mile-and-end-to-end-logistics/
- https://www.freightquote.com/blog/consolidated-vs-hub-and-spoke-ltl/
- https://www.delhivery.com/ (the network model this imitates at toy scale)
- https://2factor.in/ (the OTP provider)
