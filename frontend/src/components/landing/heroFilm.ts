import { Bike, Radar, TrainFront, Truck, Warehouse, type LucideIcon } from "lucide-react";

// Timing of /media/daakdash-world-*.mp4, rendered by blender/daakdash_world.py.
// Each scene holds for LOOP frames; the camera flight into scene k is the TRANS frames before it.
// Every motion inside a hold repeats with a period that divides LOOP, so jumping from the end of
// a hold back to its start is invisible.
export const FILM_FPS = 24;
const LOOP = 192;
const TRANS = 60;

export type FilmScene = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** loop start/end in seconds */
  start: number;
  end: number;
  /** camera flight into this scene, seconds; absent for the first scene */
  flightFrom?: number;
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  /** hotspot anchors in normalised 1920x1080 frame coordinates, projected from the Blender camera */
  spots: { x: number; y: number; title: string; body: string }[];
};

function timing(k: number) {
  const start = k * (LOOP + TRANS);
  return {
    start: start / FILM_FPS,
    end: (start + LOOP) / FILM_FPS,
    flightFrom: k === 0 ? undefined : (start - TRANS) / FILM_FPS,
  };
}
export const FILM_SCENES: FilmScene[] = [
  {
    key: "depot",
    label: "Depot",
    icon: Warehouse,
    ...timing(0),
    title: "DaakDash: your depot-to-door parcel relay across India",
    body: "Drop your parcels at the depot in your city. We scan each one once, sort it by lane and send the batch on by truck or by train. A local partner then hands it over at the door against an OTP.",
    primary: { label: "Services overview", href: "#services" },
    secondary: { label: "Send a parcel", href: "/login?as=seller" },
    spots: [
      { x: 0.8069, y: 0.3608, title: "Sorting hall", body: "Every parcel is scanned in once, sorted by destination lane and racked until its batch leaves." },
      { x: 0.1356, y: 0.3192, title: "Loading docks", body: "Batches for each lane are loaded straight onto the trucks." },
    ],
  },
  {
    key: "truck",
    label: "Truck",
    icon: Truck,
    ...timing(1),
    title: "Truck lanes for the shorter hops",
    body: "Lanes under 250 km go by road. Parcels heading to the same city ride together as one batch, so one truck carries many parcels.",
    primary: { label: "Our services", href: "#services" },
    secondary: { label: "Send a parcel", href: "/login?as=seller" },
    spots: [
      { x: 0.5663, y: 0.5812, title: "Lane batching", body: "Same origin, same destination, same truck." },
      { x: 0.4973, y: 0.2266, title: "Mode by distance", body: "Under 250 km, the system chooses road on its own." },
    ],
  },
  {
    key: "rail",
    label: "Rail",
    icon: TrainFront,
    ...timing(2),
    title: "Rail for the long haul",
    body: "Beyond 250 km, batches go by train. Every DaakDash depot sits close to a railway, which keeps long lanes cheap and steady.",
    primary: { label: "Our services", href: "#services" },
    secondary: { label: "Send a parcel", href: "/login?as=seller" },
    spots: [
      { x: 0.5203, y: 0.3428, title: "Gantry transfer", body: "Containers move from depot trucks onto rail wagons." },
      { x: 0.6538, y: 0.389, title: "Railhead depot", body: "Every depot city is served by a railway line." },
    ],
  },
  {
    key: "delivery",
    label: "Delivery",
    icon: Bike,
    ...timing(3),
    title: "Delivery partners for the last mile",
    body: "Local partners collect up to 12 parcels a run from the destination depot. At the door, the receiver gets a call with a one-time code. No code, no handover.",
    primary: { label: "Deliver with us", href: "/login?as=partner" },
    secondary: { label: "Track a parcel", href: "/track" },
    spots: [
      { x: 0.5777, y: 0.5915, title: "City depot", body: "Partners stay online until every parcel in their run is delivered." },
      { x: 0.7926, y: 0.2614, title: "OTP handover", body: "Receiver not home? The parcel goes back to the depot and is retried after 3 days." },
    ],
  },
  {
    key: "tracking",
    label: "Tracking",
    icon: Radar,
    ...timing(4),
    title: "See every handoff",
    body: "Anyone can track a parcel by its number on a public page, depot by depot. Admins see the whole network on one live map of India.",
    primary: { label: "Track a parcel", href: "/track" },
    secondary: { label: "Log in", href: "/login" },
    spots: [
      { x: 0.5432, y: 0.1851, title: "Control tower", body: "Every depot is pinned on the admin map, along with its stock and today's departures." },
      { x: 0.5446, y: 0.7812, title: "Public tracking", body: "Recipients follow the depot timeline without logging in." },
    ],
  },
];

export const FILM_SCENE_COUNT = 5;
/** whole film length; the reverse cut maps forward time t to FILM_DURATION - 1 / FILM_FPS - t */
export const FILM_DURATION = (FILM_SCENE_COUNT * LOOP + (FILM_SCENE_COUNT - 1) * TRANS) / FILM_FPS;

export const FILM_SOURCES = {
  hd: "/media/daakdash-world-1080.mp4",
  sd: "/media/daakdash-world-720.mp4",
  hdReverse: "/media/daakdash-world-1080-reverse.mp4",
  sdReverse: "/media/daakdash-world-720-reverse.mp4",
  poster: "/media/daakdash-world-poster.webp",
  width: 1920,
  height: 1080,
  /** object-position x: when a viewport crops the film's sides, keep more of the left (the depot wordmark) */
  focusX: 0.4,
};
