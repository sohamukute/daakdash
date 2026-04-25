import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";
import { StampArt } from "@/components/brand/StampArt";
import {
  getDepotSummaries, getDepotDetail,
  type DepotSummary, type DepotDetail, type Parcel,
} from "@/lib/api";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

function Row({ p }: { p: Parcel }) {
  const { t } = useT();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-1.5 last:border-0">
      <span className="font-mono text-xs text-ink">{p.trackingNumber}</span>
      <span className="font-sans text-xs text-ink/70">{p.itemName} x {p.quantity}</span>
      <span className="font-sans text-xs text-ink/50">{p.originCity} → {p.destCity}</span>
      <span className="daak-chip">{t(p.status.toLowerCase().replace(/_/g, " "))}</span>
    </li>
  );
}

// the admin's network view: every city depot pinned on a map of India. clicking a depot opens
// the day's picture there: active orders, what is physically in the depot, what left today.
export function AdminHome() {
  const { t } = useT();
  const { tokens, logout } = useAuth();
  const navigate = useNavigate();
  const token = tokens?.accessToken;

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [summaries, setSummaries] = useState<DepotSummary[]>([]);
  const [detail, setDetail] = useState<DepotDetail | null>(null);
  const [selected, setSelected] = useState<DepotSummary | null>(null);

  const openDepot = useCallback(async (d: DepotSummary) => {
    if (!token) return;
    setSelected(d);
    setDetail(null);
    try {
      setDetail(await getDepotDetail(token, d.depotId));
    } catch {
      /* panel shows loading text */
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getDepotSummaries(token).then(setSummaries).catch(() => {});
  }, [token]);

  // build the map once, then drop a marker per depot
  useEffect(() => {
    if (!mapDiv.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapDiv.current,
      style: STYLE,
      center: [80.5, 22.5],
      zoom: 3.9,
    });
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || summaries.length === 0) return;
    const markers: maplibregl.Marker[] = [];
    summaries.forEach((d) => {
      const el = document.createElement("button");
      el.className = "depot-pin";
      el.innerHTML = `<span>${d.city}</span><b>${d.stockAtDepot}</b>`;
      el.title = `${d.city}: ${d.activeOrders} active`;
      el.addEventListener("click", () => openDepot(d));
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map));
    });
    return () => markers.forEach((m) => m.remove());
  }, [summaries, openDepot]);

  function signOut() { logout(); navigate("/login"); }

  if (!token) return null;

  return (
    <div className="flex h-screen flex-col bg-manila">
      <header className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 bg-cream/80 px-5 py-3">
        <div className="flex items-center gap-3">
          <Wordmark />
          <span className="daak-chip">{t("Admin")}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app/sellers" className="daak-btn-ghost px-3 py-1.5 text-xs">{t("Sellers")}</Link>
          <LangSwitcher />
          <button onClick={signOut} className="daak-btn-ghost px-3 py-1.5 text-xs">{t("Log out")}</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_460px]">
        <div ref={mapDiv} className="min-h-[320px]" />

        <aside className="min-h-0 overflow-y-auto border-t border-ink/10 bg-manila p-4 lg:border-l lg:border-t-0">
          {!selected && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <StampArt name="train" className="h-10 w-10 text-ink/30" />
              <p className="font-display text-lg text-ink">{t("Pick a depot on the map")}</p>
              <p className="font-mono text-xs text-ink/50">
                {summaries.length} {t("depots")} · {summaries.reduce((a, s) => a + s.activeOrders, 0)} {t("active orders")}
              </p>
            </div>
          )}

          {selected && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-semibold text-ink">{selected.city}</h2>
                <button onClick={() => setSelected(null)} className="daak-btn-ghost px-2 py-1 text-xs">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  [selected.activeOrders, t("active")],
                  [selected.stockAtDepot, t("in depot")],
                  [selected.todayOutTruck, t("out by truck")],
                  [selected.todayOutTrain, t("out by train")],
                ].map(([v, l], i) => (
                  <div key={i} className="rounded-sm border border-ink/10 bg-cream px-2 py-2 text-center">
                    <p className="font-display text-xl font-semibold text-inkred tabular">{v}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wide text-ink/55">{l}</p>
                  </div>
                ))}
              </div>

              {!detail && <p className="font-mono text-xs text-ink/50">…</p>}

              {detail && (
                <>
                  <PerforatedFrame className="px-4 py-3">
                    <h3 className="mb-2 font-display text-lg font-semibold text-ink">{t("Stock in depot")}</h3>
                    {detail.stock.length === 0
                      ? <p className="font-sans text-xs text-ink/50">{t("Nothing in the depot right now.")}</p>
                      : <ul>{detail.stock.map((p) => <Row key={p.id} p={p} />)}</ul>}
                  </PerforatedFrame>

                  <PerforatedFrame className="px-4 py-3">
                    <h3 className="mb-2 font-display text-lg font-semibold text-ink">{t("Today's outbound")}</h3>
                    {detail.todayOutbound.length === 0
                      ? <p className="font-sans text-xs text-ink/50">{t("No batches left today.")}</p>
                      : (
                        <ul>
                          {detail.todayOutbound.map((b) => (
                            <li key={b.id} className="flex items-center gap-2 border-b border-ink/10 py-1.5 last:border-0">
                              <StampArt name={b.mode === "TRAIN" ? "train" : "truck"} className="h-3.5 w-3.5" />
                              <span className="font-mono text-xs text-ink">#{b.id}</span>
                              <span className="font-sans text-xs text-ink/60">
                                {b.mode === "TRAIN" ? t("by train") : t("by truck")} · {b.status.toLowerCase()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                  </PerforatedFrame>

                  <PerforatedFrame className="px-4 py-3">
                    <h3 className="mb-2 font-display text-lg font-semibold text-ink">
                      {t("Active orders")} ({detail.activeOrders.length})
                    </h3>
                    {detail.activeOrders.length === 0
                      ? <p className="font-sans text-xs text-ink/50">{t("No active orders from this depot.")}</p>
                      : <ul>{detail.activeOrders.map((p) => <Row key={p.id} p={p} />)}</ul>}
                  </PerforatedFrame>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
