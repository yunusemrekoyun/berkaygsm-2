import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { mediaApi } from "../../api/media";
import MediaUsageCard, {
  MediaUsageSkeleton,
} from "../../components/admin/media/MediaUsageCard";
import MediaResourceTable from "../../components/admin/media/MediaResourceTable";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";

const FOLDERS = [
  { value: "", label: "Tümü" },
  { value: "products", label: "Ürünler" },
  { value: "sets", label: "Setler" },
  { value: "categories", label: "Kategoriler" },
  { value: "campaigns", label: "Kampanyalar" },
  { value: "heroes", label: "Hero" },
  { value: "about", label: "Hakkımızda" },
  { value: "contact", label: "İletişim" },
  { value: "media", label: "Genel Medya" },
  { value: "avatars", label: "Avatarlar" },
];

const RESOURCE_TYPES = [
  { value: "all", label: "Tümü" },
  { value: "image", label: "Görsel" },
  { value: "video", label: "Video" },
];

export default function AdminMedia() {
  const confirm = useConfirm();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [banner, setBanner] = useState(null);
  const [activeFolder, setActiveFolder] = useState("");
  const [activeType, setActiveType] = useState("all");

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchResources = useCallback(
    async (reset = false, folder = activeFolder, type = activeType, cursor = nextCursor) => {
      setResourcesLoading(true);
      try {
        const data = await mediaApi.list({
          prefix: folder || undefined,
          resourceType: type,
          maxResults: 50,
          nextCursor: reset ? undefined : cursor || undefined,
        });
        setNextCursor(data.nextCursor);
        setResources((prev) =>
          reset ? data.resources : [...prev, ...data.resources]
        );
      } catch (error) {
        setBanner({ variant: "danger", message: extractMessage(error) });
      } finally {
        setResourcesLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    setNextCursor(null);
    fetchResources(true, activeFolder, activeType, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder, activeType]);

  const fetchUsage = async (isManual = false) => {
    if (isManual) setRefreshingUsage(true);
    else setUsageLoading(true);
    try {
      const data = await mediaApi.usage();
      setUsage({
        ...data,
        lastUpdated: data?.lastUpdated
          ? new Date(data.lastUpdated).toLocaleString("tr-TR")
          : "—",
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setUsageLoading(false);
      setRefreshingUsage(false);
    }
  };

  const handleDelete = async (resource) => {
    const ok = await confirm({
      title: "Varlığı sil",
      description: `"${resource.publicId}" diskten silinsin mi? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await mediaApi.remove(resource.publicId);
      setResources((prev) =>
        prev.filter((item) => item.publicId !== resource.publicId)
      );
      await fetchUsage(true);
      setBanner({ variant: "warning", message: "Varlık silindi" });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Medya Kütüphanesi
          </h1>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            VPS diskindeki medya dosyalarını klasöre göre görüntüleyin ve yönetin.
          </p>
        </div>
        <button
          onClick={() => fetchUsage(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
        >
          <RefreshCw className="h-4 w-4" /> Kullanımı yenile
        </button>
      </header>

      {usageLoading ? (
        <MediaUsageSkeleton />
      ) : (
        <MediaUsageCard usage={usage} refreshing={refreshingUsage} />
      )}

      {/* Klasör sekmeleri */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-1.5 shadow-sm">
          {FOLDERS.map((folder) => (
            <button
              key={folder.value}
              onClick={() => setActiveFolder(folder.value)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeFolder === folder.value
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)]"
              }`}
            >
              {folder.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tür filtresi + sayaç */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-1">
          {RESOURCE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setActiveType(type.value)}
              className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                activeType === type.value
                  ? "bg-[var(--color-bg-hover)] text-[var(--color-text-admin)] shadow-sm"
                  : "text-[var(--color-text-admin-muted)] hover:text-[var(--color-text-admin)]"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-text-admin-muted)]">
          {resources.length} varlık gösteriliyor
        </span>
      </div>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <MediaResourceTable
        resources={resources}
        loading={resourcesLoading}
        onDelete={handleDelete}
        onLoadMore={() => fetchResources(false, activeFolder, activeType, nextCursor)}
        hasMore={Boolean(nextCursor)}
      />
    </section>
  );
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}
