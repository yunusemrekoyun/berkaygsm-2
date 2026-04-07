import { useEffect, useMemo, useState } from "react";
import AdminModal from "../common/AdminModal";
import AlertBanner from "../../ui/AlertBanner.jsx";
import EntityPicker from "../discounts/EntityPicker.jsx";

const TEMPLATE_OPTIONS = [
  {
    value: "first_purchase",
    label: "İlk alışveriş",
    description: "Yeni üyeye kişiye özel kupon üretir.",
  },
  {
    value: "cart_threshold",
    label: "Sepet eşiği",
    description: "Hedef ürünlerde minimum sepet tutarını şart koşar.",
  },
  {
    value: "category_specific",
    label: "Kategori özel",
    description: "Seçili kategori/alt kategorilerde geçerli olur.",
  },
  {
    value: "winback",
    label: "Geri kazanım",
    description: "X gün sipariş vermeyen kullanıcıları hedefler.",
  },
  {
    value: "manual",
    label: "Manuel",
    description: "Esnek yapı: ürün, set ve kategori hedefleri tanımlanır.",
  },
];

const MANUAL_CODE_REGEX = /^[A-Z2-9]{4,32}$/;

export default function CouponForm({
  open,
  onClose,
  onSubmit,
  submitting = false,
  initialCoupon = null,
  optionsLoading = false,
  userOptions = [],
  productOptions = [],
  setOptions = [],
  categoryOptions = [],
}) {
  const isEditing = Boolean(initialCoupon?.id);
  const [template, setTemplate] = useState("manual");
  const [audience, setAudience] = useState("public");
  const [assignmentMode, setAssignmentMode] = useState("everyone");
  const [autoAssignNewUsers, setAutoAssignNewUsers] = useState(true);
  const [assignNow, setAssignNow] = useState(true);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [maxTotalUses, setMaxTotalUses] = useState("");
  const [winbackDays, setWinbackDays] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [active, setActive] = useState(true);

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const coupon = initialCoupon || {};

    setTemplate(coupon.template || "manual");
    setAudience(coupon.audience || "public");
    setAssignmentMode(coupon.assignmentMode || "everyone");
    setAutoAssignNewUsers(
      coupon.autoAssignNewUsers !== undefined
        ? Boolean(coupon.autoAssignNewUsers)
        : true
    );
    setAssignNow(true);

    setCode(coupon.code || "");
    setDescription(coupon.description || "");
    setPercentage(
      coupon.percentage !== undefined && coupon.percentage !== null
        ? String(coupon.percentage)
        : ""
    );
    setMinSubtotal(
      coupon.minSubtotal !== undefined && coupon.minSubtotal !== null
        ? String(coupon.minSubtotal)
        : ""
    );
    setMaxTotalUses(
      coupon.maxTotalUses !== undefined && coupon.maxTotalUses !== null
        ? String(coupon.maxTotalUses)
        : ""
    );
    setWinbackDays(
      coupon.winbackDays !== undefined && coupon.winbackDays !== null
        ? String(coupon.winbackDays)
        : ""
    );
    setStartsAt(toDateTimeLocalInput(coupon.startsAt));
    setEndsAt(toDateTimeLocalInput(coupon.endsAt));
    setActive(coupon.active !== undefined ? Boolean(coupon.active) : true);

    setSelectedUsers(mapIdListToFallback(coupon.manualUsers || []));
    setSelectedProducts(mapIdListToFallback(coupon.targets?.products || []));
    setSelectedSets(mapIdListToFallback(coupon.targets?.sets || []));
    setSelectedCategories(mapIdListToFallback(coupon.targets?.categories || []));
    setError("");
  }, [open, initialCoupon]);

  useEffect(() => {
    if (!open) return;
    setSelectedUsers((prev) => hydrateSelection(prev, userOptions));
  }, [open, userOptions]);

  useEffect(() => {
    if (!open) return;
    setSelectedProducts((prev) => hydrateSelection(prev, productOptions));
  }, [open, productOptions]);

  useEffect(() => {
    if (!open) return;
    setSelectedSets((prev) => hydrateSelection(prev, setOptions));
  }, [open, setOptions]);

  useEffect(() => {
    if (!open) return;
    setSelectedCategories((prev) => hydrateSelection(prev, categoryOptions));
  }, [open, categoryOptions]);

  const isFirstPurchaseTemplate = template === "first_purchase";
  const isWinbackTemplate = template === "winback";
  const effectiveAudience =
    isFirstPurchaseTemplate || isWinbackTemplate ? "personal" : audience;
  const isPersonal = effectiveAudience === "personal";
  const effectiveAssignmentMode = isFirstPurchaseTemplate
    ? "everyone"
    : assignmentMode;
  const requiresCategories = template === "category_specific";
  const showTargeting = !isFirstPurchaseTemplate;

  const selectedTargetCount =
    selectedProducts.length + selectedSets.length + selectedCategories.length;

  const templateMeta = useMemo(
    () => TEMPLATE_OPTIONS.find((item) => item.value === template) || null,
    [template]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;

    const percentageNumber = Number(percentage);
    if (
      !Number.isFinite(percentageNumber) ||
      percentageNumber <= 0 ||
      percentageNumber > 100
    ) {
      setError("İndirim yüzdesi 1 ile 100 arasında olmalıdır.");
      return;
    }

    const minSubtotalNumber = Number(minSubtotal || 0);
    if (!Number.isFinite(minSubtotalNumber) || minSubtotalNumber < 0) {
      setError("Minimum sepet tutarı 0 veya daha büyük olmalıdır.");
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    if (!isPersonal) {
      if (!normalizedCode) {
        setError("Herkese açık kuponlarda kod zorunludur.");
        return;
      }
      if (!MANUAL_CODE_REGEX.test(normalizedCode)) {
        setError(
          "Kupon kodu yalnızca büyük harf ve 2-9 karakterleriyle girilmelidir."
        );
        return;
      }
    }

    let maxTotalUsesValue = null;
    if (maxTotalUses !== "") {
      const parsed = Number(maxTotalUses);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setError("Toplam kullanım limiti en az 1 olmalıdır.");
        return;
      }
      maxTotalUsesValue = Math.floor(parsed);
    }

    let winbackDaysValue = null;
    if (isWinbackTemplate) {
      const parsed = Number(winbackDays);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setError("Geri kazanım kuponunda gün sayısı en az 1 olmalıdır.");
        return;
      }
      winbackDaysValue = Math.floor(parsed);
    }

    if (isPersonal && effectiveAssignmentMode === "manual" && !selectedUsers.length) {
      setError("Manuel atamada en az bir kullanıcı seçmelisiniz.");
      return;
    }

    if (requiresCategories && selectedCategories.length === 0) {
      setError("Kategori özel kupon için en az bir kategori seçmelisiniz.");
      return;
    }

    if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
      setError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }

    const payload = {
      template,
      audience: isPersonal ? "personal" : "public",
      assignmentMode: isPersonal ? effectiveAssignmentMode : "everyone",
      autoAssignNewUsers: isFirstPurchaseTemplate
        ? true
        : isPersonal && effectiveAssignmentMode === "everyone"
        ? Boolean(autoAssignNewUsers)
        : false,
      manualUsers:
        isPersonal && effectiveAssignmentMode === "manual"
          ? selectedUsers.map((item) => item.id)
          : [],
      code: isPersonal ? null : normalizedCode,
      description: description.trim(),
      percentage: percentageNumber,
      minSubtotal: minSubtotalNumber,
      maxTotalUses: maxTotalUsesValue,
      firstPurchaseOnly: isFirstPurchaseTemplate,
      winbackDays: winbackDaysValue,
      targets: {
        products: showTargeting ? selectedProducts.map((item) => item.id) : [],
        sets: showTargeting ? selectedSets.map((item) => item.id) : [],
        categories: showTargeting
          ? selectedCategories.map((item) => item.id)
          : [],
      },
      active,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      assignNow: isPersonal ? Boolean(assignNow) : false,
    };

    setError("");
    onSubmit?.(payload);
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEditing ? "Kuponu Düzenle" : "Kupon Oluştur"}
      description="Template tabanlı kuponları hedef, kullanıcı ve zaman kurallarıyla yönetin."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] sm:w-auto"
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="submit"
            form="coupon-form"
            className="w-full rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60 sm:w-auto"
            disabled={submitting}
          >
            {isEditing ? "Değişiklikleri Kaydet" : "Kupon Oluştur"}
          </button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <AlertBanner
            variant="danger"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4">
          <p className="mb-2 text-sm font-medium text-[var(--color-text-admin)]">
            Kupon şablonu
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {TEMPLATE_OPTIONS.map((item) => {
              const selected = item.value === template;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTemplate(item.value)}
                  disabled={submitting || optionsLoading}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-bg-hover)]"
                      : "border-[var(--color-border-admin)] hover:bg-[var(--color-bg-hover)]/50"
                  }`}
                >
                  <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
          {templateMeta && (
            <p className="mt-2 text-xs text-[var(--color-text-admin-muted)]">
              Seçili: {templateMeta.label}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Kullanıcı kitlesi
            </span>
            <select
              value={effectiveAudience}
              onChange={(event) => setAudience(event.target.value)}
              disabled={isFirstPurchaseTemplate || isWinbackTemplate || submitting}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] disabled:opacity-70"
            >
              <option value="public">Herkese açık</option>
              <option value="personal">Kişiye özel</option>
            </select>
            {(isFirstPurchaseTemplate || isWinbackTemplate) && (
              <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                {isFirstPurchaseTemplate
                  ? "İlk alışveriş kuponu her zaman kişiye özeldir."
                  : "Geri kazanım kuponu yalnızca kişiye özel çalışır."}
              </p>
            )}
          </label>

          {!isPersonal ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                Kupon kodu
              </span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={32}
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                placeholder="YAZ50"
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                Kod yalnızca büyük harf ve 2-9 karakterlerinden oluşabilir.
              </p>
            </label>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-hover)]/30 px-3 py-2">
              <p className="text-sm font-medium text-[var(--color-text-admin)]">
                Kişiye özel kupon kodları otomatik üretilir.
              </p>
              <p className="text-xs text-[var(--color-text-admin-muted)]">
                Kullanıcı başı tek kullanıma göre benzersiz kod atanır.
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              İndirim yüzdesi
            </span>
            <input
              type="number"
              min="1"
              max="100"
              step="0.1"
              value={percentage}
              onChange={(event) => setPercentage(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="10"
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Minimum sepet tutarı
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={minSubtotal}
              onChange={(event) => setMinSubtotal(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="0"
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Toplam kullanım limiti
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={maxTotalUses}
              onChange={(event) => setMaxTotalUses(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Boş = limitsiz"
              disabled={submitting}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
            Açıklama
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Kampanya notu"
            disabled={submitting}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Başlangıç tarihi
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Bitiş tarihi
            </span>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              disabled={submitting}
            />
          </label>
        </div>

        {isPersonal && (
          <div className="space-y-4 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text-admin)]">
              Kişiye özel atama ayarları
            </p>

            {!isFirstPurchaseTemplate && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Atama modu
                </span>
                <select
                  value={effectiveAssignmentMode}
                  onChange={(event) => setAssignmentMode(event.target.value)}
                  disabled={submitting}
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                >
                  <option value="everyone">Herkese ata</option>
                  <option value="manual">Manuel kullanıcı seç</option>
                </select>
              </label>
            )}

            {isWinbackTemplate && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Sipariş vermeme gün eşiği
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={winbackDays}
                  onChange={(event) => setWinbackDays(event.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="30"
                  disabled={submitting}
                />
              </label>
            )}

            {effectiveAssignmentMode === "manual" && !isFirstPurchaseTemplate && (
              <EntityPicker
                label="Kullanıcı seçimi"
                options={userOptions}
                value={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Kullanıcı adı veya e-posta ara"
                helper="Seçtiğiniz kullanıcılara özel kupon kodu üretilecektir."
                disabled={submitting || optionsLoading}
              />
            )}

            {effectiveAssignmentMode === "everyone" && !isFirstPurchaseTemplate && (
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
                <input
                  type="checkbox"
                  checked={autoAssignNewUsers}
                  onChange={(event) => setAutoAssignNewUsers(event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  disabled={submitting}
                />
                Kupon aktifken yeni üyelere otomatik ata
              </label>
            )}

            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
              <input
                type="checkbox"
                checked={assignNow}
                onChange={(event) => setAssignNow(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                disabled={submitting}
              />
              Kaydedince mevcut uygun kullanıcılara atamayı tetikle
            </label>
          </div>
        )}

        {showTargeting && (
          <div className="space-y-4 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                Kupon hedefleri
              </p>
              <p className="text-xs text-[var(--color-text-admin-muted)]">
                {selectedTargetCount} hedef seçildi
              </p>
            </div>

            <EntityPicker
              label="Ürünler"
              options={productOptions}
              value={selectedProducts}
              onChange={setSelectedProducts}
              placeholder="Ürün ara"
              helper="Seçili ürünler kupon kapsamına alınır."
              disabled={submitting || optionsLoading}
            />

            <EntityPicker
              label="Setler"
              options={setOptions}
              value={selectedSets}
              onChange={setSelectedSets}
              placeholder="Set ara"
              helper="Seçili setler kupon kapsamına alınır."
              disabled={submitting || optionsLoading}
            />

            <EntityPicker
              label="Kategoriler"
              options={categoryOptions}
              value={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Kategori ara"
              helper={
                requiresCategories
                  ? "Kategori özel kupon için en az bir kategori zorunludur."
                  : "Seçili kategoriler ve alt kategorileri kupon kapsamına alınır."
              }
              disabled={submitting || optionsLoading}
            />
          </div>
        )}

        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            disabled={submitting}
          />
          Kuponu aktif et
        </label>
      </form>
    </AdminModal>
  );
}

function mapIdListToFallback(ids = []) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => {
      const normalizedId = id?.toString?.() || String(id || "");
      if (!normalizedId) return null;
      return {
        id: normalizedId,
        label: normalizedId,
        hint: undefined,
      };
    })
    .filter(Boolean);
}

function hydrateSelection(selection = [], options = []) {
  const optionMap = new Map(
    (Array.isArray(options) ? options : []).map((option) => [option.id, option])
  );
  return (Array.isArray(selection) ? selection : []).map((item) => {
    const id = item?.id?.toString?.() || String(item?.id || "");
    if (!id) return item;
    return optionMap.get(id) || item;
  });
}

function toDateTimeLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
