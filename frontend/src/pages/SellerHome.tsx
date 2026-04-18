import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { Wordmark } from "@/components/brand/Wordmark";
import { PerforatedFrame } from "@/components/brand/PerforatedFrame";
import { Postmark } from "@/components/brand/Postmark";
import {
  getDepots,
  createParcel,
  createParcelsBulk,
  myParcels,
  type Depot,
  type SellerParcel,
  type CreateParcel,
  type ParcelStatus,
  type BulkResult,
} from "@/lib/api";

// the granular postal status, always shown through t() so it reads in the seller's own language
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

const CSV_FORMAT = "item, qty, receiverName, phone, originCity, destCity, address";

// six Amazon-shelf style rows, weighted Mumbai to Delhi, built from whatever depot cities exist
function buildSample(cities: string[]): string {
  const pool = cities.length ? cities : ["Mumbai", "Delhi", "Bangalore", "Pune"];
  const origin = pool.includes("Mumbai") ? "Mumbai" : pool[0];
  const dest = pool.includes("Delhi") ? "Delhi" : pool[Math.min(1, pool.length - 1)];
  const other = pool.find((c) => c !== origin && c !== dest) ?? dest;
  const rows: string[][] = [
    ["Echo Dot 4th Gen", "2", "Rahul Sharma", "9876543210", origin, dest, "12 MG Road, Connaught Place"],
    ["Kindle Paperwhite", "1", "Priya Singh", "9823456712", origin, dest, "45 Nehru Nagar, Sector 21"],
    ["Instant Pot Duo", "1", "Amit Verma", "9812345678", origin, dest, "7 Lajpat Nagar, Block C"],
    ["Boat Rockerz 450", "3", "Sneha Iyer", "9845123456", origin, dest, "22 Karol Bagh, Near Metro"],
    ["Prestige Pressure Cooker", "2", "Vikram Nair", "9856234567", origin, other, "18 Andheri West, Link Road"],
    ["Milton Thermosteel Bottle", "5", "Anjali Rao", "9867345678", other, dest, "3 Koramangala 5th Block"],
  ];
  return rows.map((r) => r.join(", ")).join("\n");
}

// one CSV line -> a CreateParcel. Address is last and may itself hold commas, so everything
// after the sixth field is rejoined rather than split further.
function parseCsvLine(line: string): CreateParcel {
  const parts = line.split(",").map((s) => s.trim());
  const [itemName, qty, receiverName, receiverPhone, originCity, destCity, ...rest] = parts;
  return {
    itemName: itemName ?? "",
    quantity: Number(qty) || 1,
    receiverName: receiverName ?? "",
    receiverPhone: receiverPhone ?? "",
    originCity: originCity ?? "",
    destCity: destCity ?? "",
    receiverAddress: rest.join(", "),
  };
}

// the seller dashboard: book single parcels, bulk-import a backlog, and watch them move.
// sellers only ever drop at their own city depot, so there is no pickup flow here.
export function SellerHome() {
  const { t } = useT();
  const { tokens, logout } = useAuth();
  const navigate = useNavigate();
  const token = tokens?.accessToken;

  const [depots, setDepots] = useState<Depot[]>([]);
  const cities = useMemo(
    () => Array.from(new Set(depots.map((d) => d.city))).sort((a, b) => a.localeCompare(b)),
    [depots],
  );

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [destCity, setDestCity] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookedTracking, setBookedTracking] = useState<string | null>(null);

  const [csvText, setCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkResult | null>(null);

  const [parcels, setParcels] = useState<SellerParcel[]>([]);

  useEffect(() => {
    if (!token) return;
    getDepots(token).then(setDepots).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (cities.length === 0) return;
    setOriginCity((c) => c || cities[0]);
    setDestCity((c) => c || cities[Math.min(1, cities.length - 1)]);
  }, [cities]);

  async function refreshParcels(tok: string) {
    try {
      const page = await myParcels(tok);
      setParcels(page.content);
    } catch {
      // transient poll failure, keep showing the last known list
    }
  }

  useEffect(() => {
    if (!token) return;
    refreshParcels(token);
    const id = setInterval(() => refreshParcels(token), 5000);
    return () => clearInterval(id);
  }, [token]);

  async function onBook(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBookError(null);
    setBookBusy(true);
    try {
      const parcel = await createParcel(token, {
        itemName,
        quantity: Number(quantity) || 1,
        receiverName,
        receiverPhone,
        receiverAddress,
        originCity,
        destCity,
      });
      setBookedTracking(parcel.trackingNumber);
      setItemName("");
      setQuantity("1");
      setReceiverName("");
      setReceiverPhone("");
      setReceiverAddress("");
      refreshParcels(token);
    } catch (err) {
      setBookError(err instanceof Error ? err.message : String(err));
    } finally {
      setBookBusy(false);
    }
  }

  async function onImport() {
    if (!token) return;
    setImportError(null);
    setImportResult(null);
    const rows = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseCsvLine);
    if (rows.length === 0) {
      setImportError(t("Paste a few lines first."));
      return;
    }
    setImportBusy(true);
    try {
      const result = await createParcelsBulk(token, rows);
      setImportResult(result);
      refreshParcels(token);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
    }
  }

  if (!token) return null;

  return (
    <div className="relative min-h-screen">
      <div className="paper-grain" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="daak-chip">{t("Seller")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher />
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="daak-btn-ghost"
            >
              {t("Log out")}
            </button>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <PerforatedFrame>
            <h2 className="mb-4 font-display text-xl font-semibold text-ink">{t("Book a parcel")}</h2>
            <form onSubmit={onBook} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("Item")}</span>
                <input
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="daak-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("Quantity")}</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="daak-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("Receiver name")}</span>
                <input
                  required
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="daak-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("Receiver phone")}</span>
                <input
                  required
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  className="daak-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("From city")}</span>
                <select
                  required
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  className="daak-select"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("Delivery address")}</span>
                <input
                  required
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  className="daak-input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("To city")}</span>
                <select
                  required
                  value={destCity}
                  onChange={(e) => setDestCity(e.target.value)}
                  className="daak-select"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              {bookError && <p className="font-sans text-sm text-inkred sm:col-span-2">{bookError}</p>}

              <button type="submit" disabled={bookBusy || !originCity || !destCity} className="daak-btn mt-1 sm:col-span-2">
                {t("Book")}
              </button>
            </form>

            {bookedTracking && (
              <div className="mt-4 flex items-center gap-4 rounded-sm border-2 border-dashed border-inkred/40 bg-cream/60 p-4">
                <Postmark label={t("Booked")} stamped className="shrink-0" />
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-ink/60">{t("Tracking number")}</p>
                  <p className="font-mono text-lg font-bold text-inkred">{bookedTracking}</p>
                </div>
              </div>
            )}
          </PerforatedFrame>

          <PerforatedFrame>
            <h2 className="mb-2 font-display text-xl font-semibold text-ink">{t("Import your backlog")}</h2>
            <p className="mb-3 font-sans text-sm text-ink/60">
              {t("One row per parcel, comma separated:")}
            </p>
            <p className="mb-3 rounded-sm bg-ink/5 px-3 py-2 font-mono text-[11px] text-ink/70">
              {CSV_FORMAT}
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={7}
              placeholder={CSV_FORMAT}
              className="daak-input font-mono text-xs"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setCsvText(buildSample(cities))}
                className="daak-btn-ghost"
              >
                {t("Load sample")}
              </button>
              <button
                type="button"
                onClick={onImport}
                disabled={importBusy}
                className="daak-btn"
              >
                {t("Import")}
              </button>
            </div>

            {importError && <p className="mt-3 font-sans text-sm text-inkred">{importError}</p>}

            {importResult && (
              <div className="mt-4">
                <p className="font-mono text-[11px] uppercase tracking-wide text-ink/60">
                  {t("Created")} {importResult.created} · {t("Failed")} {importResult.failed}
                </p>
                <div className="mt-2 max-h-48 overflow-auto rounded-sm border border-ink/10">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-ink/10 text-ink/50">
                        <th className="px-2 py-1 font-normal">{t("Row")}</th>
                        <th className="px-2 py-1 font-normal">{t("Result")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.results.map((r) => (
                        <tr key={r.row} className="border-b border-ink/5 last:border-0">
                          <td className="px-2 py-1 text-ink/60">{r.row + 1}</td>
                          <td className={`px-2 py-1 ${r.error ? "text-inkred" : "text-live"}`}>
                            {r.error ? r.error : r.trackingNumber}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </PerforatedFrame>
        </div>

        <section className="mt-8 pb-10">
          <h2 className="font-display text-xl font-semibold text-ink">{t("My parcels")}</h2>
          <div className="mt-4 flex flex-col divide-y divide-ink/10 rounded-sm border-2 border-ink/10 bg-cream/40">
            {parcels.length === 0 && (
              <p className="p-4 font-sans text-sm text-ink/50">{t("Nothing booked yet.")}</p>
            )}
            {parcels.map((p) => (
              <div key={p.trackingNumber} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-sm font-semibold text-ink">{p.trackingNumber}</span>
                  <span className="font-sans text-sm text-ink/70">
                    {p.itemName} &times; {p.quantity}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wide text-ink/40">
                    {p.receiverName} &middot; {p.destCity}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="daak-chip">{t(STATUS_LABEL[p.status])}</span>
                  {p.delivered ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-live">
                      <span className="h-1.5 w-1.5 rounded-full bg-live" />
                      {t("Delivered")}
                    </span>
                  ) : (
                    <span className="daak-chip border-ink/20 text-ink/60">{t("In progress")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
