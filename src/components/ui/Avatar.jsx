import { useEffect, useMemo, useState } from "react";
import AppImage from "./AppImage.jsx";

const COLOR_POOL = [
  "#F97316",
  "#F59E0B",
  "#10B981",
  "#14B8A6",
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#0EA5E9",
  "#3B82F6",
];

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/i, "") ??
  "";

function stringToColor(input) {
  if (!input) return "#475569";
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const index = Math.abs(hash) % COLOR_POOL.length;
  return COLOR_POOL[index];
}

function extractInitials(name) {
  if (!name) return "?";
  const cleaned = String(name).trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) {
    const single = words[0].replace(/[^A-Za-zÇĞİÖŞÜçğıöşüİı]/g, "");
    const letters = single.slice(0, 2);
    return letters ? letters.toUpperCase() : "?";
  }
  const first = words[0].charAt(0);
  const last = words[words.length - 1].charAt(0);
  const letters = `${first}${last}`.replace(/[^A-Za-zÇĞİÖŞÜçğıöşüİı]/g, "");
  return letters ? letters.toUpperCase() : "?";
}

export default function Avatar({
  src,
  name,
  alt,
  size,
  className = "",
  fallbackClassName = "",
  textClassName = "",
  style,
}) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  const resolvedSrc = useMemo(() => {
    if (!src) return null;

    let raw = null;

    if (typeof src === "string") {
      raw = src;
    } else if (typeof src === "object" && src !== null) {
      if (src.secure_url) raw = src.secure_url;
      else if (src.url) raw = src.url;
      else if (src.path) raw = src.path;
    }

    if (!raw) return null;

    try {
      if (!API_BASE_URL) return raw;
      const apiUrl = new URL(API_BASE_URL);

      // Eğer tam URL ise
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);

        const sameHost =
          url.hostname === apiUrl.hostname && url.port === apiUrl.port;

        // Aynı backend host/port ise path'i alıp /api altında normalize et
        if (sameHost) {
          raw = url.pathname; // ör: "/c1.png"
        } else {
          // Cloudinary gibi başka domain ise aynen bırak
          return raw;
        }
      }
    } catch {
      // URL parse hatası olursa alttaki generic mantığa düşsün
    }

    // Eğer path zaten /api ile başlıyorsa
    if (raw.startsWith("/api/")) {
      return `${API_BASE_URL}${raw}`;
    }

    // Sadece "c1.png" veya "/c1.png" gibi ise → /api prefix ekle
    const normalized = raw.replace(/^\/+/, "");
    return `${API_BASE_URL}/api/${normalized}`;
  }, [src]);

  const showFallback = !resolvedSrc || errored;
  const initials = useMemo(() => extractInitials(name), [name]);
  const backgroundColor = useMemo(() => stringToColor(name), [name]);
  const imageSizes = useMemo(() => {
    if (typeof size === "number") return `${size}px`;
    if (typeof size === "string" && size.trim()) return size;
    return "64px";
  }, [size]);

  const combinedStyle = {
    ...style,
    ...(size ? { width: size, height: size } : null),
    ...(showFallback ? { backgroundColor } : null),
  };

  // // 🔍 DEBUG LOGS 
  // useEffect(() => {
  //   console.log("------ AVATAR DEBUG ------");
  //   console.log("Name:", name);
  //   console.log("Raw src:", src);
  //   console.log("Resolved src:", resolvedSrc);
  //   console.log("Show fallback:", showFallback);
  //   console.log("Errored (load fail):", errored);
  //   console.log("---------------------------");
  // }, [src, resolvedSrc, showFallback, errored, name]);

  return (
    <div
      className={[
        "relative grid place-items-center overflow-hidden rounded-full text-sm font-semibold uppercase",
        showFallback ? "text-white" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={combinedStyle}
      aria-label={alt || name || "Profil"}
    >
      {showFallback ? (
        <span
          className={["select-none", fallbackClassName, textClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {initials}
        </span>
      ) : (
        <AppImage
          src={resolvedSrc}
          alt={alt || name || "Profil"}
          width={256}
          height={256}
          sizes={imageSizes}
          className="h-full w-full object-cover"
          draggable="false"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
