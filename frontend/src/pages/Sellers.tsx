import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { getSellers, type SellerInfo } from "@/lib/api";

// admin only: every onboarded seller with their business details
export function Sellers() {
  const { t } = useT();
  const { tokens, logout } = useAuth();
  const navigate = useNavigate();
  const token = tokens?.accessToken;
  const [sellers, setSellers] = useState<SellerInfo[]>([]);

  useEffect(() => {
    if (!token) return;
    getSellers(token).then(setSellers).catch(() => {});
  }, [token]);

  if (!token) return null;

  return (
    <div className="relative min-h-screen bg-manila">
      <div className="paper-grain" aria-hidden />
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="daak-chip">{t("Sellers")}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app" className="daak-btn-ghost px-3 py-1.5 text-xs">{t("Network map")}</Link>
            <LangSwitcher />
            <button onClick={() => { logout(); navigate("/login"); }} className="daak-btn-ghost px-3 py-1.5 text-xs">
              {t("Log out")}
            </button>
          </div>
        </header>

        <h1 className="mt-6 font-display text-3xl font-semibold text-ink">{t("Onboarded sellers")}</h1>
        <p className="text-sm text-ink/60">{sellers.length} {t("sellers")}</p>

        <div className="mt-5 overflow-x-auto rounded-sm border border-ink/10 bg-cream">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="border-b border-ink/10 bg-manila/60">
              <tr>
                {[t("Business"), t("GST number"), t("Address"), t("Contact"), t("Phone"), t("Login"), t("Since")].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wide text-ink/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellers.map((s) => (
                <tr key={s.loginEmail} className="border-b border-ink/5 last:border-0">
                  <td className="px-3 py-2 font-sans text-sm font-semibold text-ink">{s.businessName}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink/70">{s.gstNumber}</td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/70">{s.address}</td>
                  <td className="px-3 py-2 font-sans text-xs text-ink/70">{s.contactEmail}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink/70">{s.phone}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink/70">{s.loginEmail}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink/50">{new Date(s.onboardedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {sellers.length === 0 && (
                <tr><td className="px-3 py-6 text-center font-mono text-xs text-ink/45" colSpan={7}>{t("No sellers onboarded yet.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
