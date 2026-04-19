import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";
import { Postmark } from "@/components/brand/Postmark";
import {
  partnerOnline, partnerOffline, partnerLoad, deliver, markAbsent, sendDeliveryOtp,
  type PartnerParcel,
} from "@/lib/api";

// one card per assigned parcel: call the receiver, take the OTP, close it out
function ParcelCard({
  token, parcel, onChanged, onError,
}: {
  token: string;
  parcel: PartnerParcel;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useT();
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // pressed at the doorstep: only now does the receiver get the OTP call
  async function onSendOtp() {
    setBusy(true);
    onError("");
    try {
      await sendDeliveryOtp(token, parcel.trackingNumber);
      setOtpSent(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDeliver() {
    setBusy(true);
    onError("");
    try {
      await deliver(token, parcel.trackingNumber, otp);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onAbsent() {
    setBusy(true);
    onError("");
    try {
      await markAbsent(token, parcel.trackingNumber);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <PerforatedFrame className="flex flex-col gap-3">
      <div>
        <p className="font-display text-lg font-semibold text-ink">
          {parcel.itemName} <span className="text-ink/50">x{parcel.quantity}</span>
        </p>
        <p className="font-sans text-sm text-ink/70">{parcel.receiverName}</p>
        <p className="font-sans text-sm text-ink/60">{parcel.receiverAddress}</p>
      </div>

      <a href={`tel:${parcel.receiverPhone}`} className="daak-btn-ghost link-ink w-fit">
        {t("Call")}
      </a>

      <button onClick={onSendOtp} disabled={busy} className="daak-btn-ghost w-fit">
        {otpSent ? t("Resend OTP") : t("Send OTP")}
      </button>
      {otpSent && (
        <p className="font-mono text-[11px] text-live">{t("OTP sent to the receiver's phone.")}</p>
      )}

      <input
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder={t("Enter OTP")}
        aria-label={t("Enter OTP")}
        disabled={!otpSent}
        className="daak-input font-mono tracking-widest disabled:opacity-50"
      />

      <div className="flex gap-2">
        <button onClick={onDeliver} disabled={busy || !otp} className="daak-btn flex-1 py-3.5 text-base">
          {t("Delivered")}
        </button>
        <button onClick={onAbsent} disabled={busy} className="daak-btn-ghost flex-1 py-3.5 text-base">
          {t("Receiver absent")}
        </button>
      </div>
    </PerforatedFrame>
  );
}

// the delivery partner's phone app: go online, work the load, go home
export function PartnerApp() {
  const { t } = useT();
  const { tokens, city, email, logout } = useAuth();
  const navigate = useNavigate();
  const token = tokens?.accessToken;

  const [online, setOnline] = useState(false);
  const [parcels, setParcels] = useState<PartnerParcel[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!token) return;
    setParcels(await partnerLoad(token));
  }

  async function goOnline() {
    if (!token) return;
    setError("");
    setBusy(true);
    try {
      await partnerOnline(token);
      setOnline(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function goOffline() {
    if (!token) return;
    setError("");
    setBusy(true);
    try {
      await partnerOffline(token);
      setOnline(false);
      setParcels([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onLogout() {
    logout();
    navigate("/login");
  }

  if (!token) return null;

  return (
    <div className="relative min-h-screen">
      <div className="paper-grain" aria-hidden />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <header className="mb-5 flex items-start justify-between gap-2">
          <div className="scale-90 origin-left">
            <Wordmark />
            <p className="-mt-0.5 font-mono text-[11px] uppercase tracking-wide text-ink/50">
              {t("Delivery Partner")} · {city}
            </p>
            <p className="font-mono text-[10px] text-ink/35">{email}</p>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitcher />
            <button onClick={onLogout} className="daak-btn-ghost">
              {t("Log out")}
            </button>
          </div>
        </header>

        <button
          onClick={online ? goOffline : goOnline}
          disabled={busy}
          className={online ? "daak-btn-ghost mb-3 w-full py-4 text-base" : "daak-btn mb-3 w-full py-4 text-base"}
        >
          {online ? t("Go offline") : t("Go online")}
        </button>

        {error && <p className="mb-3 font-sans text-sm text-inkred">{error}</p>}

        {!online && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Postmark label={t("Offline")} muted stamped />
            <p className="font-sans text-sm text-ink/60">{t("You are offline")}</p>
          </div>
        )}

        {online && (
          <>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wide text-ink/50">
              {parcels.length} {t("deliveries left")}
            </p>
            <div className="flex flex-col gap-4 pb-8">
              {parcels.map((p) => (
                <ParcelCard key={p.trackingNumber} token={token} parcel={p} onChanged={refresh} onError={setError} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
