import { useState } from "react";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";

export default function SetGallery({ images = [], title = "" }) {
  const [active, setActive] = useState(0);
  const activeSrc = images[active]?.url || "/set-placeholder.jpg";
  const t = useStaticTranslation();
  const sliderCopy = (t("setDetail") || {}).slider || {};
  const goToLabel = sliderCopy.goTo || "{index}. görsele git";

  return (
    <div className="rounded-xl bg-white ring-1 ring-black/5 p-4">
      <div className="overflow-hidden rounded-xl">
        <img
          src={activeSrc}
          alt={title}
          className="h-[420px] w-full object-cover md:h-[480px]"
          draggable="false"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {images.slice(0, 6).map((img, i) => (
            <button
              key={img.publicId || i}
              onClick={() => setActive(i)}
              className={[
                "aspect-[4/5] overflow-hidden rounded-lg ring-1 transition",
                active === i
                  ? "ring-accent"
                  : "ring-black/10 hover:ring-black/20",
              ].join(" ")}
              aria-label={formatStaticText(goToLabel, { index: i + 1 })}
            >
          <img
            src={img.url}
            alt={`${title} ${i + 1}`}
            className="h-full w-full object-cover"
            draggable="false"
          />
        </button>
      ))}
        </div>
      )}
    </div>
  );
}
