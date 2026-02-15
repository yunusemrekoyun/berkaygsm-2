import { useMemo, useState } from "react";
import { Check, Copy, TicketPercent, X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatStaticText } from "../../../i18n/staticContent.js";
import AppImage from "../../../components/ui/AppImage.jsx";

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  upcoming: "bg-amber-50 text-amber-700 border-amber-200",
  used_up: "bg-slate-100 text-slate-700 border-slate-200",
  total_limit: "bg-slate-100 text-slate-700 border-slate-200",
  expired: "bg-rose-50 text-rose-700 border-rose-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  invalid: "bg-rose-50 text-rose-700 border-rose-200",
};

const TEMPLATE_FALLBACK = {
  first_purchase: "İlk alışveriş",
  cart_threshold: "Sepet eşiği",
  category_specific: "Kategori özel",
  winback: "Geri kazanım",
  manual: "Manuel",
};

const STATUS_FALLBACK = {
  active: "Kullanılabilir",
  upcoming: "Yakında",
  used_up: "Kullanım hakkı bitti",
  total_limit: "Kontenjan doldu",
  expired: "Süresi doldu",
  inactive: "Pasif",
  invalid: "Geçersiz",
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateRange(startsAt, endsAt, copy = {}) {
  if (!startsAt && !endsAt) return copy.alwaysValid || "Süresiz";
  if (startsAt && !endsAt) {
    return formatStaticText(copy.validFrom || "{start} tarihinden itibaren", {
      start: formatDateTime(startsAt),
    });
  }
  if (!startsAt && endsAt) {
    return formatStaticText(copy.validUntil || "{end} tarihine kadar", {
      end: formatDateTime(endsAt),
    });
  }
  return formatStaticText(copy.validBetween || "{start} - {end}", {
    start: formatDateTime(startsAt),
    end: formatDateTime(endsAt),
  });
}

function EligibleItemCard({ item, kind = "product", currency, copy = {} }) {
  const href =
    kind === "set"
      ? `/set/${item.slug || item.id}`
      : `/product/${item.slug || item.id}`;
  const imageUrl =
    item?.image?.url || item?.image || item?.images?.[0]?.url || null;
  const title = item?.name || (kind === "set" ? "Set" : "Ürün");
  const price = Number(item?.price ?? 0);
  const hasPrice = Number.isFinite(price) && price > 0;

  return (
    <Link
      to={href}
      className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-light/60">
        {imageUrl ? (
          <AppImage
            src={imageUrl}
            alt={title}
            width={1200}
            height={1500}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="h-full w-full object-contain p-2"
            draggable="false"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-secondary">
            {copy.noImage || "Görsel yok"}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-primary">{title}</p>
        {hasPrice && (
          <p className="mt-1 text-sm font-medium text-accent">
            {currency.format(price)}
          </p>
        )}
      </div>
    </Link>
  );
}

function EligibleItemsModal({ coupon, onClose, currency, copy = {} }) {
  if (!coupon) return null;
  const targetItems = coupon.targetItems || {};
  const products = targetItems.products || [];
  const sets = targetItems.sets || [];
  const categories = targetItems.categories || [];
  const code = coupon.code || copy.noCode || "Kod yok";
  const totalCount = products.length + sets.length + categories.length;

  return (
    <div className="fixed inset-0 z-[210]">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-label={copy.close || "Kapat"}
      />
      <div className="absolute left-1/2 top-1/2 w-[min(1000px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-primary">
              {copy.modalTitle || "Kupon kapsamı"}
            </h3>
            <p className="mt-1 text-xs text-secondary">
              {formatStaticText(copy.modalSubtitle || "Kod: {code}", { code })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-secondary hover:bg-surface-hover"
            aria-label={copy.close || "Kapat"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          {totalCount === 0 ? (
            <p className="text-sm text-secondary">
              {copy.scopeTargetedEmpty ||
                "Kupon kapsamı tanımlı, ancak listelenecek eşleşme bulunamadı."}
            </p>
          ) : (
            <div className="space-y-5">
              {products.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-primary">
                    {copy.groupProducts || "Ürünler"}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {products.map((item) => (
                      <EligibleItemCard
                        key={`p-${item.id}`}
                        item={item}
                        kind="product"
                        currency={currency}
                        copy={copy}
                      />
                    ))}
                  </div>
                </section>
              )}

              {sets.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-primary">
                    {copy.groupSets || "Setler"}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    {sets.map((item) => (
                      <EligibleItemCard
                        key={`s-${item.id}`}
                        item={item}
                        kind="set"
                        currency={currency}
                        copy={copy}
                      />
                    ))}
                  </div>
                </section>
              )}

              {categories.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-primary">
                    {copy.groupCategories || "Kategoriler"}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map((item) => (
                      <Link
                        key={`c-${item.id}`}
                        to={`/shop?category=${item.slug || item.id}`}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-secondary hover:bg-surface-hover"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CouponsSection({
  copy = {},
  coupons = [],
  loading = false,
  error = "",
  onRetry = null,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [activeCouponForModal, setActiveCouponForModal] = useState(null);
  const currency = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const templatesCopy = copy.templates || {};
  const statusesCopy = copy.statuses || {};
  const items = Array.isArray(coupons) ? coupons : [];

  const handleCopy = async (id, code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch (copyError) {
      console.error(copyError);
    }
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Kuponlarım"}
        </h2>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Kuponlarım"}
        </h2>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p>{error || copy.loadError || "Kuponlar yüklenemedi."}</p>
          {typeof onRetry === "function" && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex rounded-full border border-rose-300 px-3 py-1.5 text-xs font-medium hover:bg-rose-100"
            >
              {copy.retry || "Tekrar dene"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Kuponlarım"}
        </h2>
        <p className="mt-2 text-secondary">
          {copy.empty || "Hesabınıza atanmış bir kupon bulunmuyor."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-primary">
        {copy.heading || "Kuponlarım"}
      </h2>
      <p className="mt-1 text-sm text-secondary">
        {formatStaticText(copy.subtitle || "{count} kupon görüntüleniyor.", {
          count: items.length,
        })}
      </p>

      <div className="mt-4 space-y-3">
        {items.map((coupon) => {
          const status = String(coupon.status || "invalid").toLowerCase();
          const statusClass = STATUS_STYLES[status] || STATUS_STYLES.invalid;
          const statusLabel =
            statusesCopy[status] || STATUS_FALLBACK[status] || "Geçersiz";
          const template = String(coupon.template || "manual").toLowerCase();
          const templateLabel =
            templatesCopy[template] || TEMPLATE_FALLBACK[template] || template;
          const code = coupon.code || "";
          const audienceLabel =
            coupon.audience === "personal"
              ? copy.personalAudience || "Kişiye özel"
              : copy.publicAudience || "Herkese açık";
          const discountLabel = formatStaticText(
            copy.discountValue || "%{percentage} indirim",
            { percentage: Number(coupon.percentage || 0) }
          );
          const minSubtotal = Number(coupon.minSubtotal || 0);
          const minSubtotalLabel =
            minSubtotal > 0
              ? currency.format(minSubtotal)
              : copy.noMinSubtotal || "Alt limit yok";
          const usageLabel = formatStaticText(
            copy.usageValue || "{used}/{limit} kullanıldı",
            {
              used: Number(coupon.userUses || 0),
              limit: Number(coupon.maxUsesPerUser || 1),
            }
          );
          const targetScope = String(coupon.targetScope || "all");
          const targets = coupon.targets || {};
          const hasTargetScope =
            targetScope === "targeted" ||
            Number(targets.products?.length || 0) > 0 ||
            Number(targets.sets?.length || 0) > 0 ||
            Number(targets.categories?.length || 0) > 0;

          return (
            <article
              key={coupon.id || coupon.couponId || code}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-primary">
                      <TicketPercent className="h-3.5 w-3.5" />
                      {templateLabel}
                    </span>
                    <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-secondary">
                      {audienceLabel}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-secondary">
                      {copy.codeLabel || "Kod"}:
                    </span>
                    <code className="rounded-md bg-surface px-2 py-1 text-sm font-semibold tracking-wide text-primary">
                      {code || copy.noCode || "Kod yok"}
                    </code>
                  </div>

                  <p className="mt-2 text-sm text-secondary">
                    {coupon.description || copy.defaultDescription || "Kupon indirimi"}
                  </p>
                </div>

                {code ? (
                  <button
                    type="button"
                    onClick={() => handleCopy(coupon.id, code)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-hover"
                  >
                    {copiedId === coupon.id ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        {copy.copied || "Kopyalandı"}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {copy.copyCode || "Kodu kopyala"}
                      </>
                    )}
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-secondary sm:grid-cols-3">
                <div>
                  <span className="font-medium text-primary">
                    {copy.discountLabel || "İndirim"}:
                  </span>{" "}
                  {discountLabel}
                </div>
                <div>
                  <span className="font-medium text-primary">
                    {copy.minSubtotalLabel || "Alt sepet tutarı"}:
                  </span>{" "}
                  {minSubtotalLabel}
                </div>
                <div>
                  <span className="font-medium text-primary">
                    {copy.usageLabel || "Kullanım"}:
                  </span>{" "}
                  {usageLabel}
                </div>
              </div>

              <div className="mt-2 text-xs text-secondary">
                <span className="font-medium text-primary">
                  {copy.validityLabel || "Geçerlilik"}:
                </span>{" "}
                {formatDateRange(coupon.startsAt, coupon.endsAt, copy)}
              </div>

              <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2">
                {!hasTargetScope ? (
                  <p className="text-xs text-secondary">
                    {copy.scopeAll || "Bu kupon tüm ürünlerde geçerlidir."}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-secondary">
                      {copy.scopeTargeted ||
                        "Bu kupon yalnızca belirli ürün/kategori/setlerde geçerlidir."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveCouponForModal(coupon)}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-primary hover:bg-surface-hover"
                    >
                      {copy.showEligible || "Geçerli ürünleri listele"}
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <EligibleItemsModal
        coupon={activeCouponForModal}
        onClose={() => setActiveCouponForModal(null)}
        currency={currency}
        copy={copy}
      />
    </div>
  );
}
