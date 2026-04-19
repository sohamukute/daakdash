import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";
import { StampArt } from "@/components/brand/StampArt";
import {
  depotInbound, scanIn, depotLanes, dispatchLane, depotInboundBatches, arriveBatch,
  depotWaiting, getDepots,
  type Parcel, type LaneGroup, type BatchInfo, type Mode, type Depot,
} from "@/lib/api";

const REFRESH_MS = 5000;

function ModeTag({ mode }: { mode: Mode }) {
  const { t } = useT();
  return (
    <span className="daak-chip">
      <StampArt name={mode === "TRAIN" ? "train" : "truck"} className="h-3 w-3" />
      {mode === "TRAIN" ? t("by train") : t("by truck")}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-display text-xl font-semibold text-ink">{children}</h2>;
}

// the city depot operator console, scoped to this operator's own city. the SENDING half handles
// parcels sellers dropped here (scan in, then dispatch grouped lanes). the RECEIVING half handles
// batches arriving from other cities (mark the whole batch received, then the parcels sit here
// waiting for a delivery partner to come online and pick them up).
export function HubConsole() {
  const { t } = useT();
  const { tokens, city, logout } = useAuth();
  const navigate = useNavigate();
  const token = tokens?.accessToken;

  const [inbound, setInbound] = useState<Parcel[]>([]);
  const [lanes, setLanes] = useState<LaneGroup[]>([]);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [waiting, setWaiting] = useState<Parcel[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const cityOf = useCallback(
    (id: number) => depots.find((d) => d.id === id)?.city ?? `Depot ${id}`,
    [depots],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const [i, l, b, w, d] = await Promise.all([
      depotInbound(token), depotLanes(token), depotInboundBatches(token),
      depotWaiting(token), getDepots(token),
    ]);
    setInbound(i); setLanes(l); setBatches(b); setWaiting(w); setDepots(d);
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(key);
    try { await fn(); await load(); } finally { setBusy(null); }
  }

  function doLogout() { logout(); navigate("/login"); }

  if (!token) return null;

  return (
    <div className="relative min-h-screen">
      <div className="paper-grain" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-6">
          <div className="flex items-center gap-4">
            <Wordmark />
            <span className="font-mono text-xs uppercase tracking-wide text-ink/60">
              {t("City Depot")} - {city}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <button onClick={doLogout} className="daak-btn-ghost">{t("Log out")}</button>
          </div>
        </header>

        <main className="grid flex-1 gap-6 pb-10 lg:grid-cols-2">
          {/* SENDING: parcels dropped here, on their way out */}
          <section className="flex flex-col gap-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-inkred">
              {t("Sending from")} {city}
            </p>

            <PerforatedFrame>
              <SectionTitle>{t("Inbound")}</SectionTitle>
              {inbound.length === 0 ? (
                <p className="font-sans text-sm text-ink/50">{t("No parcels waiting to be scanned in.")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {inbound.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-2 last:border-0">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-ink">{p.trackingNumber}</span>
                        <span className="font-sans text-sm text-ink/70">{p.itemName} x {p.quantity} - {p.receiverName} - {p.destCity}</span>
                      </div>
                      <button onClick={() => act(p.trackingNumber, () => scanIn(token, p.trackingNumber))} disabled={busy === p.trackingNumber} className="daak-btn shrink-0">
                        {t("Scan in")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PerforatedFrame>

            <PerforatedFrame>
              <SectionTitle>{t("Ready to dispatch")}</SectionTitle>
              {lanes.length === 0 ? (
                <p className="font-sans text-sm text-ink/50">{t("No lanes ready yet.")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {lanes.map((l) => (
                    <li key={l.destDepotId} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-col gap-1">
                        <span className="font-display text-lg font-semibold text-ink">{l.destCity}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <ModeTag mode={l.mode} />
                          <span className="font-mono text-[11px] text-ink/60">{l.distanceKm} km</span>
                          <span className="font-mono text-[11px] text-ink/60">{l.parcelCount} {t("parcels")}</span>
                        </div>
                      </div>
                      <button onClick={() => act(`lane-${l.destDepotId}`, () => dispatchLane(token, l.destDepotId))} disabled={busy === `lane-${l.destDepotId}`} className="daak-btn shrink-0">
                        {t("Dispatch")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PerforatedFrame>
          </section>

          {/* RECEIVING: batches arriving here, then handed to partners */}
          <section className="flex flex-col gap-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-inkred">
              {t("Receiving at")} {city}
            </p>

            <PerforatedFrame>
              <SectionTitle>{t("Incoming batches")}</SectionTitle>
              {batches.length === 0 ? (
                <p className="font-sans text-sm text-ink/50">{t("No batches on the way.")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {batches.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-2 last:border-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-sm text-ink/80">{cityOf(b.originDepotId)}</span>
                        <StampArt name={b.mode === "TRAIN" ? "train" : "truck"} className="h-3 w-3 text-ink/50" />
                        <span className="font-sans text-sm text-ink/80">{cityOf(b.destDepotId)}</span>
                        <span className="font-mono text-[11px] text-ink/40">#{b.id}</span>
                      </div>
                      <button onClick={() => act(`batch-${b.id}`, () => arriveBatch(token, b.id))} disabled={busy === `batch-${b.id}`} className="daak-btn shrink-0">
                        {t("Mark arrived")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PerforatedFrame>

            <PerforatedFrame>
              <SectionTitle>{t("Received, waiting for partners")}</SectionTitle>
              {waiting.length === 0 ? (
                <p className="font-sans text-sm text-ink/50">{t("Nothing waiting. Received parcels show here until a partner comes online.")}</p>
              ) : (
                <>
                  <p className="mb-3 font-mono text-[11px] text-ink/50">
                    {waiting.length} {t("parcels")} - {t("waiting for a delivery partner to come online")}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {waiting.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-2 last:border-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-ink">{p.trackingNumber}</span>
                          <span className="font-sans text-sm text-ink/70">{p.itemName} x {p.quantity} - {p.receiverName}</span>
                        </div>
                        <span className="daak-chip shrink-0">{p.receiverAddress}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </PerforatedFrame>
          </section>
        </main>
      </div>
    </div>
  );
}
