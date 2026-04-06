import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { mediaApi } from "../../api/media";
import MediaUsageCard, {
  MediaUsageSkeleton,
} from "../../components/admin/media/MediaUsageCard";
import MediaResourceTable from "../../components/admin/media/MediaResourceTable";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";

export default function AdminMedia() {
  const confirm = useConfirm();
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [banner, setBanner] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    fetchResources(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const fetchUsage = async (isManual = false) => {
    if (isManual) setRefreshingUsage(true);
    else setUsageLoading(true);
    try {
      const data = await mediaApi.usage();
      setUsage({
        ...data,
        lastUpdated: data?.lastUpdated
          ? new Date(data.lastUpdated).toLocaleDateString()
          : "—",
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setUsageLoading(false);
      setRefreshingUsage(false);
    }
  };

  const fetchResources = async (reset = false) => {
    setResourcesLoading(true);
    try {
      const data = await mediaApi.list({
        prefix: debouncedSearch || undefined,
        maxResults: 50,
        nextCursor: reset ? undefined : nextCursor || undefined,
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
  };

  const handleDelete = async (resource) => {
    const ok = await confirm({
      title: "Varlığı sil",
      description: `“${resource.publicId}” varlığı silinsin mi? Bu işlem geri alınamaz.`,
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
      setBanner({ variant: "warning", message: "Varlık kaldırıldı" });
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
            Aktif medya sürücüsünü takip edin ve yüklenen varlıkları yönetin.
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

      <div className="grid gap-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm md:grid-cols-3">
        <label className="md:col-span-1 flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
          <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Public ID veya klasöre göre filtrele"
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          />
        </label>
        <div className="md:col-span-2 flex items-center justify-end text-xs text-[var(--color-text-admin-muted)]">
          {resources.length} varlık gösteriliyor
        </div>
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
        onLoadMore={() => fetchResources(false)}
        hasMore={Boolean(nextCursor)}
      />
    </section>
  );
}

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch (e) {
      console.error(e);
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}
