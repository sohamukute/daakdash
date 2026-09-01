import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useT } from "@/context/LanguageContext";
import { DaakDashLogo } from "./SiteHeader";

export function SiteFooter() {
  const { t } = useT();
  return (
    <footer>
      <section className="bg-dd-red px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2 data-split className="text-[44px] font-light leading-[0.98] tracking-[-0.03em] sm:text-[72px]">
            {t("Purani daak,")}<br />{t("nayi raftaar.")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/track" className="dd-pill bg-white text-dd-ink">{t("Track a parcel")}</Link>
            <Link to="/login?as=seller" className="dd-pill dd-pill--ink">
              {t("Send a parcel")}
              <span className="dd-pill-arrow"><ArrowRight size={14} aria-hidden="true" /></span>
            </Link>
          </div>
        </div>
      </section>
      <div className="bg-dd-ink px-4 py-8 text-white/60 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-5 text-[14px] sm:flex-row sm:items-center sm:justify-between">
          <DaakDashLogo className="h-9 self-start rounded-sm sm:self-auto" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label={t("Footer")}>
            <Link to="/track" className="hover:text-white">{t("Track")}</Link>
            <Link to="/login?as=seller" className="hover:text-white">{t("Join as a seller")}</Link>
            <Link to="/login?as=partner" className="hover:text-white">{t("Deliver with us")}</Link>
            <Link to="/login" className="hover:text-white">{t("Log in")}</Link>
          </nav>
          <p>© {new Date().getFullYear()} DaakDash</p>
        </div>
      </div>
    </footer>
  );
}
