// src/components/home-contact/HomeContact.jsx
import { useEffect, useRef, useState } from "react";
import { useStaticTranslation } from "../../i18n/staticContent.js";

const DEFAULT_MAP_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3081.985992063857!2d29.97270607557561!3d39.42444121543542!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14c948754a4be47f%3A0xed261a60f69cbf0f!2sBerkay%20Gsm-Teknik%20Servis!5e0!3m2!1str!2str!4v1777981350192!5m2!1str!2str";

export default function HomeContact({
  title,
  description,
  storeName,
  address,
  hours,
  mapSrc = DEFAULT_MAP_SRC,
}) {
  const t = useStaticTranslation();
  const copy = t("homeContact") || {};
  const sectionRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const resolvedStore = storeName ?? copy.storeName;
  const resolvedAddress = address ?? copy.address;
  const resolvedHours = Array.isArray(hours) && hours.length ? hours : copy.hours || [];
  const hoursLabel = copy.hoursLabel || "Çalışma Saatleri:";
  const loadMapLabel = copy.loadMap || "Haritayi yukle";
  const mapHint =
    copy.mapHint || "Harita performans icin istege bagli yuklenir.";

  useEffect(() => {
    if (mapReady || typeof window === "undefined") return undefined;
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver !== "function") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        setMapReady(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [mapReady]);

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
          <div
            ref={sectionRef}
            className="glass-surface-soft rounded-xl bg-white p-1 shadow-md ring-1 ring-black/5"
          >
            {mapReady ? (
              <iframe
                title="store-location"
                src={mapSrc}
                className="h-[260px] w-full rounded-lg sm:h-[320px] lg:h-[360px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-[260px] w-full flex-col items-center justify-center rounded-lg bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(232,242,246,0.92)_48%,rgba(208,224,231,0.92))] px-6 text-center sm:h-[320px] lg:h-[360px]">
                <div className="max-w-sm">
                  <p className="text-base font-semibold text-primary">
                    {resolvedStore}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    {resolvedAddress}
                  </p>
                  <p className="mt-4 text-sm text-secondary/80">{mapHint}</p>
                  <button
                    type="button"
                    onClick={() => setMapReady(true)}
                    className="mt-5 inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
                  >
                    {loadMapLabel}
                  </button>
                </div>
              </div>
            )}
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
