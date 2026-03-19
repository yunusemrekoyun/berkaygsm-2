import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BadgeMinus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Languages,
} from "lucide-react";
import AppImage from "../../ui/AppImage.jsx";

export default function CampaignCard({
  campaign,
  onEdit,
  onDelete,
  onTranslate,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  disableMoveUp = false,
  disableMoveDown = false,
}) {
  const { image, name, description, badge, ctaText, layout, targetSummary } =
    campaign;
  const isActive = Boolean(campaign.isActive);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-bg-admin)]">
        {image ? (
          <AppImage
            src={image.url}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-[var(--color-text-admin-muted)]">
            Görsel yok
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="absolute left-0 top-0 flex items-center gap-2 p-3 text-xs font-semibold text-white">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-3 py-1 uppercase tracking-wide">
            {layout.toLowerCase()}
            {layout === "BIG" ? (
              <BadgeCheck className="h-3.5 w-3.5" />
            ) : layout === "WIDE" ? (
              <BadgeMinus className="h-3.5 w-3.5" />
            ) : null}
          </span>
          {badge && (
            <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-primary">
              {badge}
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h3 className="text-lg font-semibold line-clamp-1">{name}</h3>
          {description && (
            <p className="mt-1 text-xs text-white/90 line-clamp-2">
              {description}
            </p>
          )}
          {ctaText && (
            <p className="mt-2 text-[11px] uppercase tracking-wide text-white/80">
              CTA: {ctaText}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4 text-sm text-[var(--color-text-admin)]">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isActive ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                Aktif
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Gizli
              </>
            )}
          </span>
          <span className="text-xs text-[var(--color-text-admin-muted)]">
            Sıra #{campaign.sortOrder ?? 0}
          </span>
        </div>

        <div className="rounded-xl border border-[var(--color-border-admin)]/70 bg-[var(--color-bg-admin)]/60 p-3 text-xs text-[var(--color-text-admin-muted)]">
          <div className="font-semibold text-[var(--color-text-admin)]">
            Hedef • {targetSummary.type === "SETS" ? "Setler" : "Ürünler"}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {targetSummary.products > 0 && (
              <div>Ürünler: {targetSummary.products}</div>
            )}
            {targetSummary.sets > 0 && <div>Setler: {targetSummary.sets}</div>}
            {targetSummary.categories > 0 && (
              <div>Kategoriler: {targetSummary.categories}</div>
            )}
            {targetSummary.discounts > 0 && (
              <div>İndirimler: {targetSummary.discounts}</div>
            )}
          </div>
          <div className="mt-2 text-[11px]">
            Bağlantı:{" "}
            <span className="font-mono text-[var(--color-text-admin)]">
              {campaign.computedLink}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disableMoveUp}
            className="rounded-lg p-2 text-[var(--color-text-admin-muted)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)] disabled:opacity-40"
            title="Yukarı taşı"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disableMoveDown}
            className="rounded-lg p-2 text-[var(--color-text-admin-muted)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)] disabled:opacity-40"
            title="Aşağı taşı"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleActive}
            className="rounded-lg p-2 text-[var(--color-text-admin-muted)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)]"
            title={isActive ? "Kampanyayı gizle" : "Kampanyayı etkinleştir"}
          >
            {isActive ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-[var(--color-text-admin-muted)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)]"
            title="Kampanyayı düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {typeof onTranslate === "function" && (
            <button
              type="button"
              onClick={onTranslate}
              className="rounded-lg p-2 text-[var(--color-text-admin-muted)] transition hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)]"
              title="Dil varyantlarını düzenle"
            >
              <Languages className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600"
            title="Kampanyayı sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
