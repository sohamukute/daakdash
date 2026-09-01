import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, PackagePlus, Search } from "lucide-react";
import { useT } from "@/context/LanguageContext";

// "Your cargo. Our mission." block: big isolated truck render, statement headline, track form.
export function IntroSection() {
  const { t } = useT();
  const navigate = useNavigate();
  const [number, setNumber] = useState("");

  function track(event: FormEvent) {
    event.preventDefault();
    const value = number.trim();
    if (value) navigate(`/track/${encodeURIComponent(value)}`);
  }

  return (
    <section id="intro" className="relative overflow-hidden bg-white px-4 pb-20 pt-24 sm:px-6 lg:px-8 lg:pb-28 lg:pt-28">
      <svg className="pointer-events-none absolute -right-24 top-6 hidden h-[620px] w-[900px] text-dd-red/25 lg:block" viewBox="0 0 900 620" fill="none" aria-hidden="true">
        <path d="M40 600C180 360 420 120 880 40" stroke="currentColor" strokeWidth="1.2" />
        <path d="M120 610C300 420 520 250 890 210" stroke="currentColor" strokeWidth="1.2" strokeDasharray="6 8" />
      </svg>

      <div className="relative mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-12">
        <div className="order-2 flex flex-col justify-end lg:order-1 lg:col-span-6">
          <h2 data-split className="text-[44px] font-light leading-[0.98] tracking-[-0.03em] text-dd-ink sm:text-[64px] lg:text-[78px]">
            {t("Your parcel.")}<br />
            {t("Our relay.")}<br />
            {t("Welcome to DaakDash.")}
          </h2>
        </div>
        <div className="order-1 lg:order-2 lg:col-span-6">
          <img
            data-reveal
            src="/images/services/tile-truck.webp"
            alt={t("A DaakDash lorry")}
            className="mx-auto w-full max-w-[680px] drop-shadow-[0_30px_40px_rgba(20,24,31,0.12)]"
            width={1200}
            height={900}
          />
        </div>
      </div>

      <div className="relative mx-auto mt-14 grid max-w-[1400px] gap-10 border-t border-dd-line pt-10 lg:grid-cols-12">
        <p data-reveal className="text-[17px] leading-relaxed text-dd-ink/75 lg:col-span-5">
          {t("DaakDash is a depot-to-door parcel courier for India. Sellers drop parcels at the depot in their city. We sort them by destination and send each lane as one batch: by train for long distances, by truck for nearer cities. A delivery partner covers the last mile and confirms each handover with an OTP.")}
        </p>
        <div data-reveal className="grid gap-3 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
          <form onSubmit={track} className="group flex flex-col justify-between gap-6 rounded-md bg-dd-stone p-5">
            <div className="flex items-center justify-between">
              <label htmlFor="intro-track" className="text-[15px] text-dd-ink">{t("Track a parcel")}</label>
              <span className="flex h-9 w-9 items-center justify-center rounded bg-dd-red text-white"><Search size={16} aria-hidden="true" /></span>
            </div>
            <div className="flex overflow-hidden rounded border border-dd-line bg-white focus-within:border-dd-red">
              <input
                id="intro-track"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="DD12345678"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[14px] outline-none"
              />
              <button type="submit" className="px-3 text-dd-red" aria-label={t("Track parcel")}>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
          <Link to="/login?as=seller" className="group flex flex-col justify-between gap-6 rounded-md bg-dd-stone p-5 transition-colors hover:bg-dd-red-soft">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-dd-ink">{t("Send a parcel")}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded bg-dd-red text-white"><PackagePlus size={16} aria-hidden="true" /></span>
            </div>
            <span className="flex items-center gap-2 text-[14px] text-dd-ink/70">
              {t("Join as a seller")}
              <ArrowRight size={16} className="text-dd-red transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
