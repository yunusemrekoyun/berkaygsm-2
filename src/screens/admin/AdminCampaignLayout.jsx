import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Radio,
  Square,
} from "lucide-react";
import { campaignApi } from "../../api/campaigns";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useAdminLang } from "../../context/LangContext.jsx";

const SLOT_CONFIG = [
  {
    id: "slot-big",
    label: "Ana Vitrin",
    description: "Büyük 2x2 hero kartı",
    layout: "BIG",
    sortOrder: 0,
    className: "md:col-span-2 md:row-span-2",
  },
  {
    id: "slot-wide",
    label: "Geniş Banner",
    description: "2x1 yatay kart",
    layout: "WIDE",
    sortOrder: 1,
    className: "md:col-span-2 md:row-span-1",
  },
  {
    id: "slot-small-a",
    label: "Kare (Sol)",
    description: "Küçük kare",
    layout: "SMALL",
    sortOrder: 2,
    className: "md:col-span-1 md:row-span-1",
  },
  {
    id: "slot-small-b",
    label: "Kare (Sağ)",
    description: "Küçük kare",
    layout: "SMALL",
    sortOrder: 3,
    className: "md:col-span-1 md:row-span-1",
  },
];

export default function AdminCampaignLayout() {
  const { adminLang } = useAdminLang();
  const [campaigns, setCampaigns] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [, setDraggingId] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  useEffect(() => {
    loadData(adminLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLang]);

  const loadData = async (lang = adminLang) => {
    setLoading(true);
    try {
      const list = await campaignApi.listManage({ includeInactive: true }, lang);
      setCampaigns(list);
      setAssignments(deriveAssignments(list));
    } catch (error) {
      setBanner({
        variant: "danger",
        message: extractMessage(error),
      });
      setCampaigns([]);
      setAssignments({});
    } finally {
      setLoading(false);
    }
  };

  const campaignMap = useMemo(() => {
    const map = new Map();
    campaigns.forEach((campaign) => map.set(campaign.id, campaign));
    return map;
  }, [campaigns]);

  const assignedIds = useMemo(() => {
    return new Set(
      Object.values(assignments)
        .filter(Boolean)
        .map((id) => String(id))
    );
  }, [assignments]);

  const availableCampaigns = useMemo(() => {
    const sorted = [...campaigns].sort(
      (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
    );
    return sorted.filter((campaign) => !assignedIds.has(campaign.id));
  }, [campaigns, assignedIds]);

  const persistAssignments = useCallback(
    async (nextAssignments, { highlight = null, layout = null } = {}) => {
      setAssignments(nextAssignments);
      setSaving(true);
      setBanner(null);
      try {
        const slotOrder = SLOT_CONFIG.map((slot) => nextAssignments[slot.id]).filter(
          Boolean
        );

        const sortedByCurrent = [...campaigns].sort(
          (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
        );
        const rest = sortedByCurrent
          .map((campaign) => campaign.id)
          .filter((id) => !slotOrder.includes(id));

        const newOrderIds = [...slotOrder, ...rest];
        if (newOrderIds.length) {
          await campaignApi.reorder(
            newOrderIds.map((id, index) => ({ id, sortOrder: index }))
          );
        }

        const updates = [];
        SLOT_CONFIG.forEach((slot) => {
          const id = nextAssignments[slot.id];
          if (!id) return;
          const campaign = campaignMap.get(id);
          if (!campaign || campaign.layout !== slot.layout) {
            updates.push(
              campaignApi.update(id, {
                layout: slot.layout,
              }, adminLang)
            );
          }
        });

        const assignedSet = new Set(slotOrder);
        campaigns.forEach((campaign) => {
          if (
            !assignedSet.has(campaign.id) &&
            (campaign.layout === "BIG" || campaign.layout === "WIDE")
          ) {
            updates.push(
              campaignApi.update(campaign.id, {
                layout: "SMALL",
              }, adminLang)
            );
          }
        });

        if (updates.length) {
          await Promise.all(updates);
        }

        const updatedCampaigns = campaigns.map((campaign) => {
          const idx = newOrderIds.indexOf(campaign.id);
          const slot = SLOT_CONFIG.find(
            (entry) => nextAssignments[entry.id] === campaign.id
          );
          const nextLayout = slot
            ? slot.layout
            : !assignedSet.has(campaign.id) &&
              (campaign.layout === "BIG" || campaign.layout === "WIDE")
            ? "SMALL"
            : campaign.layout;
          return {
            ...campaign,
            sortOrder: idx === -1 ? campaign.sortOrder : idx,
            layout: nextLayout,
          };
        });

        setCampaigns(updatedCampaigns);

        setBanner({
          variant: "success",
          message: highlight
            ? `Yerleşim güncellendi • ${highlight}${layout ? ` (${layout})` : ""}`
            : "Kampanya yerleşimi güncellendi",
        });
      } catch (error) {
        setBanner({
          variant: "danger",
          message: extractMessage(error),
        });
        await loadData(adminLang);
      } finally {
        setSaving(false);
        setDragOverSlot(null);
        setDraggingId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adminLang, campaignMap, campaigns]
  );

  const handleDropToSlot = useCallback(
    async (slotId, campaignId) => {
      if (!campaignId || saving) return;
      const slot = SLOT_CONFIG.find((entry) => entry.id === slotId);
      if (!slot) return;
      if (!campaignMap.has(campaignId)) return;

      const next = produceAssignments(assignments, slotId, campaignId);
      await persistAssignments(next, {
        highlight: slot.label,
        layout: slot.layout,
      });
    },
    [assignments, campaignMap, persistAssignments, saving]
  );

  const handleSlotTap = useCallback(
    async (slotId) => {
      if (!selectedCampaignId || saving) return;
      setSelectedCampaignId(null);
      await handleDropToSlot(slotId, selectedCampaignId);
    },
    [handleDropToSlot, saving, selectedCampaignId]
  );

  const handleRemove = useCallback(
    async (campaignId) => {
      if (!campaignId || saving) return;
      const next = produceAssignments(assignments, null, campaignId);
      await persistAssignments(next, { highlight: "Uygun liste" });
    },
    [assignments, persistAssignments, saving]
  );

  const handleSlotClear = async (slotId) => {
    const current = assignments[slotId];
    if (!current) return;
    const next = { ...assignments, [slotId]: null };
    await persistAssignments(next, { highlight: "Slot temizlendi" });
  };

  const handleDragStart = (campaignId) => {
    setDraggingId(campaignId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverSlot(null);
  };

  const onSlotDragOver = (event, slotId) => {
    event.preventDefault();
    if (dragOverSlot !== slotId) setDragOverSlot(slotId);
  };

  const onSlotDrop = async (event, slotId) => {
    event.preventDefault();
    const campaignId = event.dataTransfer.getData("text/plain");
    setDragOverSlot(null);
    if (!campaignId) return;
    await handleDropToSlot(slotId, campaignId);
  };

  const onAvailableDrop = async (event) => {
    event.preventDefault();
    const campaignId = event.dataTransfer.getData("text/plain");
    if (!campaignId) return;
    await handleRemove(campaignId);
  };

  const assignedCards = SLOT_CONFIG.map((slot) => {
    const campaignId = assignments[slot.id];
    const campaign = campaignId ? campaignMap.get(campaignId) : null;
    return { slot, campaign };
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/campaigns"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Geri
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            <LayoutDashboard className="h-4 w-4" />
            Yerleşim
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-admin-muted)]">
          <span className="hidden sm:inline">Kampanyaları ana sayfa sıralamasını yansıtmak için ızgaraya sürükleyin.</span>
          <span className="sm:hidden">Kampanyayı seçip slota dokunarak atayın.</span>
        </p>
      </header>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_minmax(300px,1fr)]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-admin)] pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-admin)]">
                  Anasayfa Kampanya Yerleşimi
                </h2>
                <p className="text-xs text-[var(--color-text-admin-muted)]">
                  Slotlar ana sayfa yerleşimini yansıtır (büyük, geniş, küçük, küçük).
                </p>
              </div>
              <button
                type="button"
                onClick={loadData}
                disabled={loading || saving}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Yenileniyor
                  </>
                ) : (
                  <>
                    <Radio className="h-3.5 w-3.5" />
                    Sıfırla
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:auto-rows-[210px] md:grid-cols-4 md:grid-rows-2">
              {assignedCards.map(({ slot, campaign }) => {
                const isOver = dragOverSlot === slot.id;
                const isTapTarget = !!selectedCampaignId && !campaign;
                return (
                  <div
                    key={slot.id}
                    onDragOver={(event) => onSlotDragOver(event, slot.id)}
                    onDrop={(event) => onSlotDrop(event, slot.id)}
                    onClick={() => isTapTarget && handleSlotTap(slot.id)}
                    className={`relative min-h-[160px] overflow-hidden rounded-2xl border-2 border-dashed transition md:min-h-0 ${
                      isTapTarget
                        ? "cursor-pointer border-[var(--color-text-admin)] bg-[var(--color-bg-admin)] ring-2 ring-[var(--color-text-admin)]/30"
                        : isOver
                          ? "border-[var(--color-text-admin)] bg-[var(--color-bg-admin)]"
                          : "border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/50"
                    } ${slot.className}`}
                  >
                    {campaign ? (
                      <SlotCampaignCard
                        campaign={campaign}
                        onRemove={() => handleSlotClear(slot.id)}
                        onDragStart={() => handleDragStart(campaign.id)}
                        onDragEnd={handleDragEnd}
                        disabled={saving}
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-6 text-center text-[var(--color-text-admin-muted)] md:py-0">
                        <Square className="h-8 w-8" />
                        <div className="text-sm font-semibold">{slot.label}</div>
                        <p className="text-xs">{slot.description}</p>
                        <p className="text-[11px] uppercase">
                          {isTapTarget ? "Buraya ata" : <span className="hidden sm:inline">Buraya bırak</span>}
                        </p>
                      </div>
                    )}
                    <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-admin-muted)]">
                      <Megaphone className="h-3 w-3" />
                      {slot.layout}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onAvailableDrop}
            className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-admin)] pb-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                  Uygun kampanyalar
                </p>
                <p className="text-xs text-[var(--color-text-admin-muted)]">
                  Atamak için sürükleyin veya kaldırmak için buraya bırakın.
                </p>
              </div>
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-admin-muted)]" />
              )}
            </div>

            {selectedCampaignId && (
              <p className="mt-3 rounded-xl bg-[var(--color-bg-admin)] px-3 py-2 text-xs text-[var(--color-text-admin-muted)] sm:hidden">
                Seçildi — yukarıdan bir slota dokunarak atayın.{" "}
                <button
                  type="button"
                  className="font-semibold text-[var(--color-text-admin)] underline"
                  onClick={() => setSelectedCampaignId(null)}
                >
                  İptal
                </button>
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {availableCampaigns.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--color-border-admin)] px-4 py-6 text-center text-xs text-[var(--color-text-admin-muted)]">
                  Tüm kampanyalar yerleşime yerleştirildi.
                </li>
              ) : (
                availableCampaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <AvailableCampaignCard
                      campaign={campaign}
                      onDragStart={() => handleDragStart(campaign.id)}
                      onDragEnd={handleDragEnd}
                      disabled={saving}
                      selected={selectedCampaignId === campaign.id}
                      onTap={() =>
                        setSelectedCampaignId((prev) =>
                          prev === campaign.id ? null : campaign.id
                        )
                      }
                    />
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SlotCampaignCard({ campaign, onRemove, onDragStart, onDragEnd, disabled }) {
  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", campaign.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`relative flex h-full flex-col justify-between rounded-2xl bg-[var(--color-bg-card)] p-4 text-[var(--color-text-admin)] shadow-sm transition ${
        disabled ? "opacity-70" : "cursor-move hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-bg-hover)]">
          <GripVertical className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{campaign.name}</div>
          <div className="truncate text-xs text-[var(--color-text-admin-muted)]">
            {campaign.description || "—"}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-admin-muted)]">
        <span>
          Yerleşim: <strong>{campaign.layout}</strong>
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
        >
          Kaldır
        </button>
      </div>
    </div>
  );
}

function AvailableCampaignCard({ campaign, onDragStart, onDragEnd, disabled, selected, onTap }) {
  return (
    <div
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", campaign.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onClick={onTap}
      className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
        selected
          ? "border-[var(--color-text-admin)] bg-[var(--color-bg-card)] ring-2 ring-[var(--color-text-admin)]/20"
          : "border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]"
      } ${disabled ? "opacity-60" : "cursor-pointer sm:cursor-move hover:bg-[var(--color-bg-card)]"}`}
    >
      <div className="mt-1">
        <Megaphone className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold">{campaign.name}</div>
        {campaign.description && (
          <div className="truncate text-xs text-[var(--color-text-admin-muted)]">
            {campaign.description}
          </div>
        )}
        <div className="mt-1 text-[11px] uppercase text-[var(--color-text-admin-muted)]">
          Geçerli yerleşim: {campaign.layout}
        </div>
      </div>
    </div>
  );
}

function deriveAssignments(list) {
  const assignments = {};
  const used = new Set();
  const sorted = [...list].sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)
  );

  SLOT_CONFIG.forEach((slot) => {
    const match = sorted.find(
      (campaign) => campaign.layout === slot.layout && !used.has(campaign.id)
    );
    assignments[slot.id] = match ? match.id : null;
    if (match) used.add(match.id);
  });

  return assignments;
}

function produceAssignments(current, targetSlotId, campaignId) {
  const next = { ...current };
  Object.keys(next).forEach((slotKey) => {
    if (next[slotKey] === campaignId) {
      next[slotKey] = null;
    }
  });

  if (targetSlotId) {
    next[targetSlotId] = campaignId;
  }
  return next;
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
