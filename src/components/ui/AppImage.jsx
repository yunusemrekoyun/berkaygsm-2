import Image from "next/image";

const REMOTE_RE = /^https?:\/\//i;
const BLOB_RE = /^blob:/i;
const DATA_RE = /^data:/i;

export default function AppImage({
  src,
  alt = "",
  className = "",
  width = 1600,
  height = 1600,
  sizes = "100vw",
  fill = false,
  priority = false,
  quality = 82,
  draggable,
  ...rest
}) {
  if (!src) return null;

  const resolvedSrc = typeof src === "string" ? src : String(src);
  const unoptimized =
    REMOTE_RE.test(resolvedSrc) ||
    BLOB_RE.test(resolvedSrc) ||
    DATA_RE.test(resolvedSrc);

  if (fill) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        unoptimized={unoptimized}
        priority={priority}
        quality={quality}
        draggable={draggable}
        {...rest}
      />
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      unoptimized={unoptimized}
      priority={priority}
      quality={quality}
      draggable={draggable}
      {...rest}
    />
  );
}
