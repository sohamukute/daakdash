import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";

export function Landing() {
  const { t } = useT();
  const navigate = useNavigate();
  const [tn, setTn] = useState("");

  function track() {
    const v = tn.trim();
    if (v) navigate(`/track/${encodeURIComponent(v)}`);
  }

  return (
    <div className="relative min-h-screen">
      <div className="paper-grain" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Wordmark />
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <Link to="/login" className="daak-btn-ghost px-3 py-1.5 text-xs">{t("Log in")}</Link>
          </div>
        </header>

        <section className="animate-fade-up flex flex-1 flex-col justify-center py-12">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-inkred">
            India · rail + road · depot to door
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] text-ink sm:text-6xl">
            {t("Every parcel, delivered honestly.")}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink/70">
            {t("From your city depot to their door.")} {t("purani daak, nayi raftaar")} — old post,
            new speed. We batch every parcel onto a train or a truck and carry it across India.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); track(); }} className="mt-8 max-w-md">
            <PerforatedFrame className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="font-mono text-[10px] uppercase tracking-wide text-ink/50">
                    {t("Tracking number")}
                  </label>
                  <input
                    value={tn}
                    onChange={(e) => setTn(e.target.value)}
                    placeholder="DD12345678"
                    className="w-full bg-transparent font-mono text-lg uppercase tracking-wider text-ink outline-none placeholder:text-ink/30"
                  />
                </div>
                <button type="submit" className="daak-btn">{t("Track")}</button>
              </div>
            </PerforatedFrame>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login?as=seller" className="daak-btn">{t("Send a parcel")}</Link>
            <Link to="/login?as=partner" className="daak-btn-ghost">{t("Deliver with us")}</Link>
          </div>
        </section>

        <section className="grid gap-5 border-t border-ink/10 py-12 md:grid-cols-3">
          {[
            { n: "01", ti: "Drop at your city depot", d: "You bring parcels to the DaakDash depot in your city. We never chase a pickup." },
            { n: "02", ti: "We batch and haul", d: "Parcels going the same way ride together. Far lanes go by train, near ones by truck." },
            { n: "03", ti: "Door delivery with OTP", d: "The destination depot hands it to a partner who delivers same day, confirmed by OTP." },
          ].map((s) => (
            <div key={s.n}>
              <div className="font-mono text-xs text-inkred">{s.n}</div>
              <h3 className="mt-2 font-display text-xl font-semibold text-ink">{t(s.ti)}</h3>
              <p className="mt-1 text-sm text-ink/65">{t(s.d)}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-ink/10 py-6 font-mono text-[11px] text-ink/50">
          DaakDash · {t("purani daak, nayi raftaar")}
        </footer>
      </div>
    </div>
  );
}
