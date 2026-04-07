import { Trash2, Image as ImageIcon, Video } from "lucide-react";
import { formatBytesShort } from "./MediaUsageCard";
import AppImage from "../../ui/AppImage.jsx";

const FOLDER_LABELS = {
  products: "Ürünler",
  sets: "Setler",
  categories: "Kategoriler",
  campaigns: "Kampanyalar",
  heroes: "Hero",
  about: "Hakkımızda",
  contact: "İletişim",
  media: "Genel Medya",
  avatars: "Avatarlar",
  orders: "Siparişler",
};

function resolveFolder(publicId = "") {
  const firstSegment = String(publicId).split("/")[0] || "";
  return FOLDER_LABELS[firstSegment] || firstSegment || "kök";
}

function ResourceThumbnail({ resource }) {
  const isImage = resource.resourceType === "image";
  const isVideo = resource.resourceType === "video";
  const previewUrl = isImage
    ? resource.secureUrl || resource.url
    : isVideo
    ? resource.posterUrl
    : null;

  if (previewUrl) {
    return (
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <AppImage
          src={previewUrl}
          alt={resource.publicId}
          width={48}
          height={48}
          sizes="48px"
          className="h-full w-full object-cover"
        />
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Video className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[var(--color-bg-hover)] text-[var(--color-text-admin-muted)]">
      {isVideo ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
    </div>
  );
}

export default function MediaResourceTable({
  resources = [],
  loading = false,
  onDelete,
  onLoadMore,
  hasMore,
}) {
  if (loading && !resources.length) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-hover)]"
          />
        ))}
      </div>
    );
  }

  if (!resources.length && !loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-6 py-12 text-center">
        <p className="max-w-md text-sm text-[var(--color-text-admin-muted)]">
          Bu klasörde henüz medya dosyası yok.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-table-container overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/70 text-sm">
        <thead className="bg-[var(--color-bg-hover)]/60 text-[var(--color-text-admin-muted)]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Medya</th>
            <th className="px-4 py-3 text-left font-medium">Klasör</th>
            <th className="px-4 py-3 text-left font-medium">Boyut</th>
            <th className="px-4 py-3 text-left font-medium">Tarih</th>
            <th className="px-4 py-3 text-right font-medium">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)]/60 text-[var(--color-text-admin)]">
          {resources.map((resource) => (
            <tr
              key={resource.publicId}
              className="hover:bg-[var(--color-bg-hover)]/40"
            >
              <td className="px-4 py-3" data-label="Medya">
                <div className="flex items-center gap-3">
                  <ResourceThumbnail resource={resource} />
                  <div className="min-w-0">
                    <div
                      className="truncate font-semibold max-w-[180px] sm:max-w-xs"
                      title={resource.publicId}
                    >
                      {resource.publicId}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--color-text-admin-muted)]">
                      <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                        resource.resourceType === "video"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {resource.resourceType === "video" ? "VİDEO" : "GÖRSEL"}
                      </span>
                      {resource.format && (
                        <span>{resource.format.toUpperCase()}</span>
                      )}
                      {resource.width && resource.height && (
                        <span className="hidden sm:inline">
                          {resource.width}×{resource.height}
                        </span>
                      )}
                      {resource.duration && (
                        <span>{Math.round(resource.duration)}s</span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-admin-muted)]" data-label="Klasör">
                {resolveFolder(resource.publicId)}
              </td>
              <td className="px-4 py-3" data-label="Boyut">
                {formatBytesShort(resource.bytes)}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-admin-muted)]" data-label="Tarih">
                {formatDate(resource.createdAt)}
              </td>
              <td className="px-4 py-3 text-left md:text-right" data-label="İşlem">
                <button
                  onClick={() => onDelete?.(resource)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 md:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(hasMore || loading) && (
        <div className="border-t border-[var(--color-border-admin)]/70 bg-[var(--color-bg-admin)]/40 px-4 py-3 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
          >
            {loading ? "Yükleniyor…" : "Daha fazla yükle"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
