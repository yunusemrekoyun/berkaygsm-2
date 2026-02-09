import { useEffect, useState, useCallback } from "react";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";
import AppImage from "../ui/AppImage.jsx";

/**
 * SetIncludes
 * - Set içindeki ürünleri grid halinde gösterir
 * - Bir ürüne tıklanınca ürün DETAYINA GİTMEZ, modal/lightbox açar
 * - Modal içinde sadece ürün görselleri gezilebilir
 */
export default function SetIncludes({ products = [] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null); // { name, images: [...] }
  const [idx, setIdx] = useState(0);
  const t = useStaticTranslation();
  const copy = t("setDetail") || {};
  const qtyLabel = copy.qtyLabel || "Adet";
  const productFallback = copy.productFallback || "Ürün";
  const noImage = copy.noImage || "Görsel yok";
  const noImagesAvailable = copy.noImagesAvailable || "Görsel bulunmuyor";
  const closeLabel = copy.close || "Kapat";
  const sliderCopy = copy.slider || {};
  const prevLabel = sliderCopy.prev || "Önceki görsel";
  const nextLabel = sliderCopy.next || "Sonraki görsel";
  const goToLabel = sliderCopy.goTo || "{index}. görsele git";

  const openLightbox = (p) => {
    const pics = Array.isArray(p?.images) ? p.images : [];
    setActive({
      name: p?.name || productFallback,
      images: pics.length ? pics : [],
    });
    setIdx(0);
    setOpen(true);
  };

  const closeLightbox = useCallback(() => {
    setOpen(false);
    setActive(null);
    setIdx(0);
  }, []);

  const next = useCallback(() => {
    if (!active?.images?.length) return;
    setIdx((i) => (i + 1) % active.images.length);
  }, [active]);

  const prev = useCallback(() => {
    if (!active?.images?.length) return;
    setIdx((i) => (i - 1 + active.images.length) % active.images.length);
  }, [active]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeLightbox, next, prev]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((entry, i) => {
          const p = entry?.product || entry; // API shape güvenliği
          const cover = p?.images?.[0]?.url;
          return (
            <button
              key={p?.id || p?._id || i}
              type="button"
              onClick={() => openLightbox(p)}
              className="group w-full text-left rounded-xl border border-zinc-200 bg-white transition hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <div className="aspect-[1/1] w-full overflow-hidden bg-zinc-100">
                {cover ? (
                  <AppImage
                    src={cover}
                    alt={p?.name || productFallback}
                    width={640}
                    height={640}
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                    {noImage}
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="line-clamp-1 text-sm font-medium text-zinc-800">
                  {p?.name || productFallback}
                </div>
                {entry?.quantity ? (
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {qtyLabel}: {entry.quantity}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox / Modal */}
      {open && active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            // backdrop tıklamasıyla kapat
            if (e.target === e.currentTarget) closeLightbox();
          }}
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="truncate text-sm font-semibold text-zinc-800">
                {active.name}
              </h3>
              <button
                type="button"
                onClick={closeLightbox}
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
                aria-label={closeLabel}
              >
                {closeLabel}
              </button>
            </header>

            <div className="relative">
              {active.images?.length ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  <AppImage
                    key={active.images[idx]?.publicId || idx}
                    src={active.images[idx]?.url}
                    alt={`${active.name} ${idx + 1}`}
                    width={1600}
                    height={1200}
                    sizes="(max-width: 768px) 100vw, 70vw"
                    className="h-full w-full object-contain"
                  />

                  {active.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={prev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-sm shadow hover:bg-white"
                        aria-label={prevLabel}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={next}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-sm shadow hover:bg-white"
                        aria-label={nextLabel}
                      >
                        ›
                      </button>
                      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                        {idx + 1} / {active.images.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-zinc-500">
                  {noImagesAvailable}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {active.images?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t p-3">
                {active.images.map((img, i) => (
                  <button
                    key={img.publicId || i}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded border ${
                      i === idx ? "border-zinc-800" : "border-zinc-200"
                    }`}
                    aria-label={formatStaticText(goToLabel, { index: i + 1 })}
                  >
                    <AppImage
                      src={img.url}
                      alt={`${active.name} ${i + 1}`}
                      width={200}
                      height={200}
                      sizes="64px"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
