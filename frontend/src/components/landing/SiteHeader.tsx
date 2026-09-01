import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { cn } from "@/lib/cn";
import { LandingLink } from "./LandingLink";

const NAV = [
  { label: "Services", href: "#services" },
  { label: "Track", href: "/track" },
  { label: "Deliver with us", href: "/login?as=partner" },
];

export function DaakDashLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center bg-dd-red px-4 font-clash text-[19px] font-semibold italic tracking-[-0.02em] text-white", className)}>
      Daak
      <span className="mx-[3px] inline-block h-[6px] w-[6px] -translate-y-[1px] rounded-full bg-dd-amber" aria-hidden="true" />
      Dash
    </span>
  );
}

export function SiteHeader() {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-0 pt-0 sm:px-3 sm:pt-3">
      <div className="flex h-14 items-stretch overflow-hidden bg-white/95 shadow-[0_1px_0_rgba(20,24,31,0.08)] backdrop-blur-md sm:rounded-md">
        <Link to="/" aria-label={t("DaakDash home")} className="flex">
          <DaakDashLogo />
        </Link>
        <nav className="hidden items-stretch lg:flex" aria-label={t("Main navigation")}>
          {NAV.map((item) => (
            <LandingLink key={item.href} href={item.href} className="dd-nav-link">
              {t(item.label)}
            </LandingLink>
          ))}
        </nav>
        <div className="ml-auto flex items-stretch">
          <div className="hidden items-center border-l border-dd-line px-3 md:flex">
            <LangSwitcher className="cursor-pointer rounded border-dd-line bg-white px-2.5 py-1.5 font-clash text-[13px] text-dd-ink hover:border-dd-red/50 focus-visible:border-dd-red" />
          </div>
          <Link to="/login" className="hidden items-center border-l border-dd-line px-5 text-[14px] text-dd-ink transition-colors hover:text-dd-red md:flex">
            {t("Log in")}
          </Link>
          <Link
            to="/login?as=seller"
            className="group hidden items-center gap-2 bg-dd-red px-5 text-[14px] text-white transition-colors hover:bg-dd-red-deep sm:flex"
          >
            {t("Send a parcel")}
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="flex w-14 items-center justify-center border-l border-dd-line text-dd-ink lg:hidden"
            aria-expanded={open}
            aria-controls="dd-mobile-nav"
            aria-label={open ? t("Close menu") : t("Open menu")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        id="dd-mobile-nav"
        className={cn(
          "mt-0 origin-top overflow-hidden bg-white shadow-lg transition-all duration-300 sm:mt-2 sm:rounded-md lg:hidden",
          open ? "max-h-[520px] opacity-100" : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col p-2" aria-label={t("Mobile navigation")}>
          {NAV.map((item) => (
            <LandingLink key={item.href} href={item.href} onNavigate={() => setOpen(false)} className="rounded px-4 py-3 text-[17px] text-dd-ink hover:bg-dd-stone">
              {t(item.label)}
            </LandingLink>
          ))}
          <Link to="/login" className="rounded px-4 py-3 text-[17px] text-dd-ink hover:bg-dd-stone">{t("Log in")}</Link>
          <div className="flex items-center justify-between gap-3 border-t border-dd-line px-4 pt-3 mt-2">
            <LangSwitcher className="cursor-pointer rounded border-dd-line bg-white px-2.5 py-1.5 font-clash text-[13px] text-dd-ink hover:border-dd-red/50 focus-visible:border-dd-red" />
            <Link to="/login?as=seller" className="dd-pill dd-pill--solid">
              {t("Send a parcel")}
              <span className="dd-pill-arrow"><ArrowRight size={14} aria-hidden="true" /></span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
