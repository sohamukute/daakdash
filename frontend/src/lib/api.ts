// API client for the DaakDash depot 3PL. Same origin through the gateway.

export type Tokens = { accessToken: string; refreshToken: string };
export type Role = "SELLER" | "ADMIN" | "HUB" | "PARTNER";

const KEY = "daakdash.tokens";

export function saveTokens(t: Tokens) { localStorage.setItem(KEY, JSON.stringify(t)); }
export function loadTokens(): Tokens | null {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Tokens) : null;
}
export function clearTokens() { localStorage.removeItem(KEY); }

function claims(accessToken: string): Record<string, unknown> {
  try { return JSON.parse(atob(accessToken.split(".")[1])); } catch { return {}; }
}
export function roleFromToken(accessToken: string): Role | null {
  const r = claims(accessToken).role;
  return r === "SELLER" || r === "ADMIN" || r === "HUB" || r === "PARTNER" ? r : null;
}
export function cityFromToken(accessToken: string): string | null {
  const c = claims(accessToken).city;
  return typeof c === "string" ? c : null;
}
export function emailFromToken(accessToken: string): string | null {
  const s = claims(accessToken).sub;
  return typeof s === "string" ? s : null;
}

async function readMessage(res: Response): Promise<string | null> {
  try { const b = await res.json(); return b.message ?? b.error ?? null; } catch { return null; }
}

async function post(path: string, body: unknown): Promise<Tokens> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await readMessage(res)) ?? "request failed");
  return res.json();
}
// onboarding: the system issues the login and mails the credentials, nothing comes back here
export type OnboardResult = { loginEmail: string; message: string };

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await readMessage(res)) ?? "request failed");
  return res.json();
}

export function onboardSeller(body: {
  businessName: string; gstNumber: string; address: string; contactEmail: string; phone: string;
}): Promise<OnboardResult> {
  return postJson("/api/auth/onboard/seller", body);
}

export function onboardPartner(body: {
  name: string; personalEmail: string; phone: string; homeCity: string;
}): Promise<OnboardResult> {
  return postJson("/api/auth/onboard/partner", body);
}

// serviced cities, open (no auth) so the signup form can offer a partner their home city
export async function getDepotsPublic(): Promise<Depot[]> {
  const res = await fetch("/api/depots");
  if (!res.ok) throw new Error("could not load cities");
  return res.json();
}
export function login(email: string, password: string): Promise<Tokens> {
  return post("/api/auth/login", { email, password });
}

async function authJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await readMessage(res)) ?? "request failed");
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---- shared types ----

export type ParcelStatus =
  | "BOOKED" | "AT_ORIGIN_DEPOT" | "SORTED" | "IN_TRANSIT"
  | "AT_DEST_DEPOT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RECEIVER_ABSENT";

export type Mode = "TRAIN" | "TRUCK";

export type Depot = { id: number; city: string; lat: number; lng: number };

export type CreateParcel = {
  itemName: string; quantity?: number;
  receiverName: string; receiverPhone: string; receiverAddress: string;
  originCity: string; destCity: string;
};

export type Parcel = {
  id: number; trackingNumber: string; sellerEmail: string;
  itemName: string; quantity: number;
  receiverName: string; receiverPhone: string; receiverAddress: string;
  originCity: string; destCity: string; originDepotId: number; destDepotId: number;
  status: ParcelStatus; batchId: number | null; assignedPartner: string | null;
  createdAt: string; updatedAt: string;
};

export type SellerParcel = {
  trackingNumber: string; itemName: string; quantity: number;
  receiverName: string; destCity: string; status: ParcelStatus; delivered: boolean;
};

export type PartnerParcel = {
  trackingNumber: string; itemName: string; quantity: number;
  receiverName: string; receiverPhone: string; receiverAddress: string; destCity: string;
};

export type LaneGroup = {
  destDepotId: number; destCity: string; mode: Mode; distanceKm: number; parcelCount: number;
};

export type BatchInfo = {
  id: number; originDepotId: number; destDepotId: number; mode: Mode;
  status: "BUILDING" | "DEPARTED" | "ARRIVED"; departedAt: string | null; arrivedAt: string | null;
};

export type TrackStep = { status: ParcelStatus; depotCity: string | null; at: string };
export type Track = {
  trackingNumber: string; status: ParcelStatus;
  originCity: string; destCity: string; timeline: TrackStep[];
};

export type Page<T> = { content: T[]; totalElements: number; totalPages: number; number: number; size: number };

// ---- public ----
export function getDepots(token: string): Promise<Depot[]> { return authJson("/api/depots", token); }
export async function getTrack(trackingNumber: string): Promise<Track | null> {
  const res = await fetch(`/api/track/${encodeURIComponent(trackingNumber)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("could not load tracking");
  return res.json();
}

// ---- seller ----
export function createParcel(token: string, body: CreateParcel): Promise<Parcel> {
  return authJson("/api/parcels", token, { method: "POST", body: JSON.stringify(body) });
}
export type BulkResult = { created: number; failed: number; results: { row: number; trackingNumber: string | null; error: string | null }[] };
export function createParcelsBulk(token: string, parcels: CreateParcel[]): Promise<BulkResult> {
  return authJson("/api/parcels/bulk", token, { method: "POST", body: JSON.stringify({ parcels }) });
}
export function myParcels(token: string, page = 0, size = 100): Promise<Page<SellerParcel>> {
  return authJson(`/api/parcels?page=${page}&size=${size}`, token);
}

// ---- depot operator (scoped by token city) ----
export function depotInbound(token: string): Promise<Parcel[]> { return authJson("/api/depot/inbound", token); }
export function scanIn(token: string, trackingNumber: string): Promise<void> {
  return authJson("/api/depot/scan-in", token, { method: "POST", body: JSON.stringify({ trackingNumber }) });
}
export function depotLanes(token: string): Promise<LaneGroup[]> { return authJson("/api/depot/lanes", token); }
export function dispatchLane(token: string, destDepotId: number): Promise<{ dispatched: number }> {
  return authJson("/api/depot/dispatch", token, { method: "POST", body: JSON.stringify({ destDepotId }) });
}
export function depotWaiting(token: string): Promise<Parcel[]> { return authJson("/api/depot/waiting", token); }
export function depotInboundBatches(token: string): Promise<BatchInfo[]> { return authJson("/api/depot/inbound-batches", token); }
export function arriveBatch(token: string, batchId: number): Promise<{ arrived: number }> {
  return authJson("/api/depot/arrive", token, { method: "POST", body: JSON.stringify({ batchId }) });
}

// ---- delivery partner ----
export function partnerOnline(token: string): Promise<{ assigned: number }> {
  return authJson("/api/partner/online", token, { method: "POST" });
}
export function partnerOffline(token: string): Promise<void> {
  return authJson("/api/partner/offline", token, { method: "POST" });
}
export function partnerLoad(token: string): Promise<PartnerParcel[]> { return authJson("/api/partner/load", token); }
export function sendDeliveryOtp(token: string, trackingNumber: string): Promise<void> {
  return authJson("/api/partner/send-otp", token, { method: "POST", body: JSON.stringify({ trackingNumber }) });
}
export function deliver(token: string, trackingNumber: string, otp: string): Promise<void> {
  return authJson("/api/partner/deliver", token, { method: "POST", body: JSON.stringify({ trackingNumber, otp }) });
}
export function markAbsent(token: string, trackingNumber: string): Promise<void> {
  return authJson("/api/partner/absent", token, { method: "POST", body: JSON.stringify({ trackingNumber }) });
}

// ---- admin ----
export function adminParcels(token: string, page = 0, size = 100): Promise<Page<Parcel>> {
  return authJson(`/api/admin/parcels?page=${page}&size=${size}`, token);
}

export type DepotSummary = {
  depotId: number; city: string; lat: number; lng: number;
  activeOrders: number; stockAtDepot: number; todayOutTruck: number; todayOutTrain: number;
};
export type DepotDetail = {
  depotId: number; city: string;
  activeOrders: Parcel[]; stock: Parcel[]; todayOutbound: BatchInfo[];
};
export type SellerInfo = {
  businessName: string; gstNumber: string; address: string;
  contactEmail: string; phone: string; loginEmail: string; onboardedAt: string;
};

export function getDepotSummaries(token: string): Promise<DepotSummary[]> {
  return authJson("/api/admin/depots/summary", token);
}
export function getDepotDetail(token: string, id: number): Promise<DepotDetail> {
  return authJson(`/api/admin/depot/${id}`, token);
}
export function getSellers(token: string): Promise<SellerInfo[]> {
  return authJson("/api/admin/sellers", token);
}
