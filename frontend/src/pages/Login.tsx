import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useT } from "@/context/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";
import { useAuth } from "@/context/AuthContext";
import {
  login, onboardSeller, onboardPartner, getDepotsPublic,
  type Depot, type OnboardResult,
} from "@/lib/api";

type Mode = "login" | "seller" | "partner";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink/55">{label}</span>
      {children}
    </label>
  );
}

export function Login() {
  const { t } = useT();
  const { setTokens } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const as = params.get("as");

  const [mode, setMode] = useState<Mode>(as === "seller" ? "seller" : as === "partner" ? "partner" : "login");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<OnboardResult | null>(null);
  const [busy, setBusy] = useState(false);

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // seller onboarding
  const [businessName, setBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  // partner onboarding
  const [pname, setPname] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [pphone, setPphone] = useState("");
  const [homeCity, setHomeCity] = useState("");

  useEffect(() => {
    getDepotsPublic().then((d) => setDepots([...d].sort((a, b) => a.city.localeCompare(b.city)))).catch(() => {});
  }, []);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setDone(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        setTokens(await login(email, password));
        navigate("/app");
      } else if (mode === "seller") {
        setDone(await onboardSeller({ businessName, gstNumber, address, contactEmail, phone }));
      } else {
        if (!homeCity) throw new Error(t("Please choose your home city."));
        setDone(await onboardPartner({ name: pname, personalEmail, phone: pphone, homeCity }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
      <div className="paper-grain" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <Link to="/"><Wordmark /></Link>
          <LangSwitcher />
        </div>

        <PerforatedFrame className="px-6 py-6">
          <div className="mb-5 flex flex-wrap gap-2">
            {([["login", t("Log in")], ["seller", t("Join as seller")], ["partner", t("Join as partner")]] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wide transition ${
                  mode === m ? "bg-ink text-cream" : "text-ink/55 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {done ? (
            <div className="animate-stamp-in rounded-sm border-2 border-dashed border-live bg-cream px-5 py-6 text-center">
              <p className="font-display text-xl font-semibold text-ink">{t("You are onboard.")}</p>
              <p className="mt-2 font-mono text-sm text-ink/70">{done.message}</p>
              <p className="mt-1 font-mono text-xs text-ink/50">{t("Your login")}: {done.loginEmail}</p>
              <button onClick={() => switchMode("login")} className="daak-btn mt-4">{t("Log in")}</button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              {mode === "login" && (
                <>
                  <h1 className="font-display text-3xl font-semibold text-ink">{t("Log in")}</h1>
                  <Field label={t("Email")}>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="daak-input" />
                  </Field>
                  <Field label={t("Password")}>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="daak-input" />
                  </Field>
                </>
              )}

              {mode === "seller" && (
                <>
                  <h1 className="font-display text-3xl font-semibold text-ink">{t("Join as seller")}</h1>
                  <p className="text-sm text-ink/60">{t("We create your account and mail the login credentials to you.")}</p>
                  <Field label={t("Business name")}>
                    <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className="daak-input" />
                  </Field>
                  <Field label={t("GST number")}>
                    <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} required minLength={15} maxLength={15} className="daak-input font-mono" placeholder="15 characters" />
                  </Field>
                  <Field label={t("Business address")}>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} required className="daak-input" />
                  </Field>
                  <Field label={t("Contact email")}>
                    <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required className="daak-input" />
                  </Field>
                  <Field label={t("Phone")}>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="daak-input" placeholder="+91..." />
                  </Field>
                </>
              )}

              {mode === "partner" && (
                <>
                  <h1 className="font-display text-3xl font-semibold text-ink">{t("Join as partner")}</h1>
                  <p className="text-sm text-ink/60">{t("We create your account and mail the login credentials to you.")}</p>
                  <Field label={t("Full name")}>
                    <input value={pname} onChange={(e) => setPname(e.target.value)} required className="daak-input" />
                  </Field>
                  <Field label={t("Personal email")}>
                    <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} required className="daak-input" />
                  </Field>
                  <Field label={t("Phone")}>
                    <input value={pphone} onChange={(e) => setPphone(e.target.value)} required className="daak-input" placeholder="+91..." />
                  </Field>
                  <Field label={t("Home city")}>
                    <select value={homeCity} onChange={(e) => setHomeCity(e.target.value)} required className="daak-select">
                      <option value="">{t("Choose a city")}</option>
                      {depots.map((d) => <option key={d.id} value={d.city}>{d.city}</option>)}
                    </select>
                  </Field>
                </>
              )}

              {error && <p className="font-mono text-xs text-inkred">{error}</p>}
              <button type="submit" disabled={busy} className="daak-btn">
                {busy ? "…" : mode === "login" ? t("Log in") : t("Submit")}
              </button>
            </form>
          )}
        </PerforatedFrame>
      </div>
    </div>
  );
}
