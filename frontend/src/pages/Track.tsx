import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";
import { Postmark } from "@/components/brand/Postmark";
import { DashedRoute } from "@/components/brand/DashedRoute";
import { StampArt } from "@/components/brand/StampArt";
import { getTrack, type ParcelStatus, type Track as TrackData } from "@/lib/api";

const STATUS_LABEL: Record<ParcelStatus, string> = {
  BOOKED: "Booked",
  AT_ORIGIN_DEPOT: "At origin depot",
  SORTED: "Sorted",
  IN_TRANSIT: "In transit",
  AT_DEST_DEPOT: "At destination depot",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  RECEIVER_ABSENT: "Receiver absent",
};

// the full journey every parcel walks, so the timeline shows what is done and what is still to
// come. a stage with a real event is done; the rest are drawn greyed as upcoming.
const JOURNEY: ParcelStatus[] = [
  "BOOKED", "AT_ORIGIN_DEPOT", "SORTED", "IN_TRANSIT", "AT_DEST_DEPOT", "OUT_FOR_DELIVERY", "DELIVERED",
];
function eventFor(track: TrackData, stage: ParcelStatus) {
  return [...track.timeline].reverse().find((e) => e.status === stage);
}

export function Track() {
  const { t } = useT();
  const navigate = useNavigate();
  const { trackingNumber } = useParams();

  const [search, setSearch] = useState("");
  const [track, setTrack] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!trackingNumber) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setTrack(null);
    getTrack(trackingNumber)
      .then((res) => {
        if (cancelled) return;
        if (res) setTrack(res);
        else setNotFound(true);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [trackingNumber]);

  function goTrack() {
    const value = search.trim();
    if (value) navigate(`/track/${encodeURIComponent(value)}`);
  }

  return (
    <div className="relative min-h-screen">
      <div className="paper-grain" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
        <header className="mb-8 flex items-center justify-between">
          <Wordmark />
          <LangSwitcher />
        </header>

        {!trackingNumber && (
          <PerforatedFrame className="px-5 py-5">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-wide text-ink/60">
              {t("Track a parcel")}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goTrack()}
                placeholder={t("Tracking number")}
                aria-label={t("Tracking number")}
                className="daak-input font-mono"
              />
              <button onClick={goTrack} className="daak-btn shrink-0 sm:w-32">{t("Track")}</button>
            </div>
          </PerforatedFrame>
        )}

        {trackingNumber && loading && <p className="font-mono text-sm text-ink/50">{t("Track")}…</p>}

        {trackingNumber && !loading && notFound && (
          <PerforatedFrame className="px-5 py-5">
            <p className="text-sm text-inkred">{t("No parcel found for this tracking number.")}</p>
          </PerforatedFrame>
        )}

        {trackingNumber && !loading && track && (
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
              <Postmark label={t(STATUS_LABEL[track.status])} stamped />
              <div>
                <div className="font-mono text-xs uppercase tracking-wide text-ink/50">
                  {t("Tracking number")}
                </div>
                <div className="font-mono text-lg font-bold text-ink">{track.trackingNumber}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 font-sans text-sm text-ink/80">
              <span className="font-semibold">{track.originCity}</span>
              <StampArt name="train" className="h-5 w-5 text-inkred" />
              <span className="font-semibold">{track.destCity}</span>
            </div>

            {track.status === "OUT_FOR_DELIVERY" && (
              <div className="animate-stamp-in rounded-sm border-2 border-dashed border-inkred bg-cream px-5 py-4 text-center">
                <div className="font-mono text-xs uppercase tracking-wide text-inkred">
                  {t("Out for delivery. The OTP has been sent to the receiver's phone.")}
                </div>
              </div>
            )}

            <div className="flex flex-col">
              {JOURNEY.map((stage, i) => {
                const ev = eventFor(track, stage);
                const done = !!ev;
                const current = stage === track.status;
                return (
                  <div key={stage} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                          done || current ? "border-inkred bg-inkred" : "border-ink/20 bg-cream"
                        }`}
                      />
                      {i < JOURNEY.length - 1 && (
                        <DashedRoute vertical className="min-h-[2.5rem] flex-1" />
                      )}
                    </div>
                    <div className="pb-6">
                      <div className={`font-sans text-sm font-semibold ${done ? "text-ink" : "text-ink/35"}`}>
                        {t(STATUS_LABEL[stage])}
                        {current && <span className="ml-2 text-inkred">- {t("now")}</span>}
                      </div>
                      {ev?.depotCity && (
                        <div className="mt-0.5 flex items-center gap-1 text-ink/60">
                          <StampArt name="train" className="h-3.5 w-3.5" />
                          <span className="font-sans text-xs">{ev.depotCity}</span>
                        </div>
                      )}
                      <div className="mt-0.5 font-mono text-[11px] text-ink/40">
                        {ev ? new Date(ev.at).toLocaleString() : t("pending")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
