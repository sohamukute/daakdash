import { useT } from "@/context/LanguageContext";
import { SectionLabel } from "./ui";

const SERVICES = [
  { name: "Depot network", image: "/images/services/tile-depot.webp", body: "One depot per city. Drop parcels off and they are scanned in and sorted by lane." },
  { name: "Truck lanes", image: "/images/services/tile-truck.webp", body: "Under 250 km goes by road: one truck, many parcels." },
  { name: "Rail lanes", image: "/images/services/tile-rail.webp", body: "250 km and beyond goes by train from depots that sit next to the railway." },
  { name: "Doorstep delivery", image: "/images/services/tile-delivery.webp", body: "Local partners deliver, and every handover needs an OTP." },
  { name: "Live tracking", image: "/images/services/tile-tracking.webp", body: "A public, depot-by-depot timeline for every parcel. No login needed." },
  { name: "Bulk booking", image: "/images/services/tile-parcels.webp", body: "Book single parcels, or paste a whole CSV backlog at once." },
];

export function ServicesSection() {
  const { t } = useT();
  return (
    <section id="services" className="bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28" aria-labelledby="services-heading">
      <div className="mx-auto max-w-[1400px]">
        <SectionLabel>{t("Services")}</SectionLabel>
        <h2 id="services-heading" data-split className="mt-3 text-[40px] font-light leading-none tracking-[-0.03em] text-dd-ink sm:text-[56px]">
          {t("What we move, and how")}
        </h2>
        <div className="mt-10 grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
          {SERVICES.map((item) => (
            <article key={item.name} data-reveal className="group overflow-hidden rounded-md bg-dd-stone">
              <div className="relative aspect-[4/3]">
                <img
                  src={item.image}
                  alt=""
                  width={1200}
                  height={900}
                  loading="lazy"
                  className="absolute inset-0 m-auto h-[80%] w-[86%] object-contain transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]"
                />
              </div>
              <div className="px-5 pb-5">
                <h3 className="text-[18px] text-dd-ink">{t(item.name)}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-dd-ink/65">{t(item.body)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
