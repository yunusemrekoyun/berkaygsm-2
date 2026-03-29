import Image from "next/image";
import {
  cloudinaryImageLoader,
  isCloudinaryImageUrl,
  optimizeCloudinaryImageUrl,
} from "../../utils/cloudinaryImage.js";
import { resolveImageSrc } from "../../utils/imageSrc.js";

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

  const resolvedSrc = resolveImageSrc(src);
  if (!resolvedSrc) return null;
  const isCloudinary = isCloudinaryImageUrl(resolvedSrc);
  const optimizedSrc = optimizeCloudinaryImageUrl(resolvedSrc, {
    width: fill ? width : width,
    quality,
  });
  const imageSrc = isCloudinary ? resolvedSrc : optimizedSrc;
  const unoptimized =
    (REMOTE_RE.test(resolvedSrc) && !isCloudinary) ||
    BLOB_RE.test(resolvedSrc) ||
    DATA_RE.test(resolvedSrc);

  if (fill) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        fill
        loader={isCloudinary ? cloudinaryImageLoader : undefined}
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
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      loader={isCloudinary ? cloudinaryImageLoader : undefined}
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
