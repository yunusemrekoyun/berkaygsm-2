// src/components/home-contact/HomeContact.jsx
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function HomeContact({
  title,
  description,
  storeName,
  address,
  hours,
  mapSrc = "https://www.google.com/maps?q=Ba%C4%9Fdat%20Caddesi%20123%2C%20%C4%B0stanbul&output=embed",
}) {
  const t = useStaticTranslation();
  const copy = t("homeContact") || {};
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const resolvedStore = storeName ?? copy.storeName;
  const resolvedAddress = address ?? copy.address;
  const resolvedHours = Array.isArray(hours) && hours.length ? hours : copy.hours || [];
  const hoursLabel = copy.hoursLabel || "Çalışma Saatleri:";

  return (
    <section className="app-section">
      <h2 className="mb-8 text-balance text-center font-serif text-3xl font-bold tracking-tight text-primary">
        {resolvedTitle}
      </h2>

      <div className="glass-surface rounded-xl bg-contact-bg p-6 shadow-sm ring-1 ring-black/5 md:p-8">
        <div
          className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2"
          data-animate="stagger"
          data-animate-children="> *"
        >
          {/* Map */}
          <div className="glass-surface-soft rounded-xl bg-white p-1 shadow-md ring-1 ring-black/5">
            <iframe
              title="store-location"
              src={mapSrc}
              className="h-[260px] w-full rounded-lg sm:h-[320px] lg:h-[360px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Text block */}
          <div className="text-primary">
            <p className="mb-5 max-w-prose leading-relaxed text-secondary">
              {resolvedDescription}
            </p>

            <p className="font-semibold">{resolvedStore}</p>
            <p className="mb-5">{resolvedAddress}</p>

            <p className="font-semibold">{hoursLabel}</p>
            <ul className="mt-1 space-y-1 text-secondary">
              {resolvedHours.map((h) => (
                <li key={h.k}>
                  {h.k}: <span className="font-medium text-primary">{h.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
