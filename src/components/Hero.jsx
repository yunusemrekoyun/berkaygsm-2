import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  useStaticTranslation,
  formatStaticText,
} from "../i18n/staticContent.js";
import AppImage from "./ui/AppImage.jsx";
import { resolveImageSrc } from "../utils/imageSrc.js";

/**
 * slides item yapısı (backend'den heroApi.list ile geliyor):
 * {
 *   id, title, subtitle, buttonText,
 *   image: { url, ... } | null,
 *   video: { url, ... } | null,
 *   computedLink: "/shop" veya "/shop?category=<id>"
 * }
 */
export default function Hero({
  slides = [],
  imageAutoMs = 6000, // fotoğraf slaytı için otomatik geçiş süresi
  className = "",
}) {
  const resolveMediaSrc = (value) => resolveImageSrc(value) || undefined;
  const t = useStaticTranslation();
  const heroCopy = t("heroComponent") || {};
  const noMediaLabel = heroCopy.noMedia || "Medya yok";
  const prevLabel = heroCopy.prev || "Önceki";
  const nextLabel = heroCopy.next || "Sonraki";
  const goToSlideLabel = heroCopy.goToSlide || "{index}. slayta git";

  const [index, setIndex] = useState(0);
  const active = slides[index] || null;
  const previousIndex =
    slides.length > 1 ? (index - 1 + slides.length) % slides.length : index;
  const nextIndex = slides.length > 1 ? (index + 1) % slides.length : index;

  // Her slayt için video referansı (sadece aktif olanı oynatacağız)
  const videoRefs = useRef({});

  // Slayt uzunluğu (resim için sabit süre, video için metadata’daki süre)
  const nextDelayMs = useMemo(() => {
    if (!active) return imageAutoMs;
    if (active.video?.url) {
      // Metadata henüz yoksa küçük bir fallback (7sn); yüklendiğinde 'ended' ile geçiş yapılacak.
      return Math.max(1000, Math.floor((active.video.duration || 7) * 1000));
    }
    return imageAutoMs;
  }, [active, imageAutoMs]);

  // Otomatik kaydırma: Resimlerde timer; Video’da 'ended' ile geç.
  useEffect(() => {
    if (!active) return;
    let tId;

    const isVideo = !!active.video?.url;
    const currentRef = videoRefs.current[active.id];

    if (isVideo) {
      // Videonun bittiğinde geç; metadata gelene kadar da küçük bir emniyet süresi.
      const onEnded = () => go(1);
      currentRef?.addEventListener?.("ended", onEnded);

      // emniyet: bazı tarayıcılarda ended tetiklenmezse diye timeout
      tId = setTimeout(() => {
        go(1);
      }, nextDelayMs + 500);

      // Aktif olduysa oynatmayı dene (sessiz – autoplay uyumu için muted)
      if (currentRef) {
        currentRef.muted = true;
        currentRef.playsInline = true;
        currentRef.currentTime = 0;
        currentRef.play().catch(() => {});
      }

      return () => {
        currentRef?.removeEventListener?.("ended", onEnded);
        if (currentRef) {
          try {
            currentRef.pause();
          } catch {
            // ignore
          }
          
        }
        clearTimeout(tId);
      };
    }

    // Resim: sabit süre
    tId = setTimeout(() => go(1), nextDelayMs);
    return () => clearTimeout(tId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, active?.id, active?.video?.url, nextDelayMs]);

  function go(step) {
    if (!slides.length) return;
    setIndex((i) => (i + step + slides.length) % slides.length);
  }

  if (!slides.length) {
    // hiçbir hero yoksa boş dön (home fallback’leri zaten başka kısımlarda)
    return null;
  }

  return (
    <section
      className={[
        "relative w-full min-h-[520px] h-[70vh] md:h-[calc(100vh-4rem)] overflow-hidden",
        className,
      ].join(" ")}
    >
      {/* SLAYTLAR */}
      {slides.map((s, i) => {
        const isActive = i === index;
        const shouldLoadImage =
          i === index || i === previousIndex || i === nextIndex;
        const shouldLoadVideo = i === index;
        return (
          <div
            key={s.id || i}
            className={[
              "absolute inset-0 transition-opacity duration-700",
              isActive ? "opacity-100 z-10" : "opacity-0 z-0",
            ].join(" ")}
            aria-hidden={!isActive}
          >
            {s.image?.url ? (
              shouldLoadImage ? (
                <AppImage
                  src={s.image.url}
                  alt={s.title || ""}
                  fill
                  sizes="100vw"
                  priority={i === 0}
                  quality={86}
                  className="absolute inset-0 h-full w-full object-cover"
                  draggable="false"
                />
              ) : (
                <div className="absolute inset-0 bg-slate-900/40" />
              )
            ) : s.video?.url ? (
              shouldLoadVideo ? (
                <video
                  ref={(el) => (videoRefs.current[s.id] = el)}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={resolveMediaSrc(s.video.url)}
                  poster={resolveMediaSrc(s.video.posterUrl)}
                  playsInline
                  muted
                  preload="metadata"
                  // loop YOK → bittiğinde sonraki slayta geçiyoruz
                  // controls={false}
                />
              ) : (
                <div className="absolute inset-0 bg-slate-900/40" />
              )
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-black/5 text-white/80">
                {noMediaLabel}
              </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-0 bg-black/20" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />

            {/* İçerik */}
            <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col items-center justify-end px-6 text-center pb-24 md:pb-32">
              {s.title ? (
                <h1 className="max-w-4xl text-4xl font-serif font-semibold tracking-[-0.03em] text-white drop-shadow md:text-5xl lg:text-6xl">
                  {s.title}
                </h1>
              ) : null}
              {s.subtitle ? (
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 drop-shadow md:text-lg">
                  {s.subtitle}
                </p>
              ) : null}

              {s.buttonText ? (
                s.computedLink ? (
                  <Link
                    to={s.computedLink}
                    className="mt-8 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow hover:bg-accent-hover transition"
                  >
                    {s.buttonText}
                  </Link>
                ) : (
                  <button
                    className="mt-8 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-white shadow hover:bg-accent-hover transition"
                    onClick={() =>
                      window.scrollTo({ top: 800, behavior: "smooth" })
                    }
                  >
                    {s.buttonText}
                  </button>
                )
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Pager noktaları */}
      <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id || i}
            onClick={() => setIndex(i)}
            className={[
              "h-2.5 w-2.5 rounded-full transition",
              i === index
                ? "scale-110 bg-white"
                : "bg-white/70 hover:bg-white/90",
            ].join(" ")}
            aria-label={formatStaticText(goToSlideLabel, { index: i + 1 })}
          />
        ))}
      </div>

      {/* Sol/Sağ oklar (isteğe bağlı) */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/40 sm:left-4"
            aria-label={prevLabel}
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/40 sm:right-4"
            aria-label={nextLabel}
          >
            ›
          </button>
        </>
      )}
    </section>
  );
}
