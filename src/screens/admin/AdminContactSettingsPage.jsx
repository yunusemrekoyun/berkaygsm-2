import { useEffect, useMemo, useRef, useState } from "react";
import { contactPageApi } from "../../api/contact";
import { mediaApi } from "../../api/media";
import ContactTranslationModal from "../../components/admin/contact/ContactTranslationModal.jsx";
import {
  MapPin,
  Mail,
  Phone,
  Clock3,
  Image as ImageIcon,
  Upload,
  Trash2,
  Save,
  RefreshCcw,
  ShieldCheck,
  Send,
  Type,
  Quote,
  Loader2,
  Languages,
} from "lucide-react";
import { HAS_TRANSLATIONS, TRANSLATION_LANGS } from "../../constants/lang.js";
import AppImage from "../../components/ui/AppImage.jsx";
import {
  OFFICIAL_ADDRESS,
  OFFICIAL_ADDRESS_NOTE,
  OFFICIAL_PHONE,
  OFFICIAL_PHONE_NOTE,
  OFFICIAL_SUPPORT_EMAIL,
  OFFICIAL_SUPPORT_RESPONSE_NOTE,
} from "../../config/siteContact.js";

const BASE_LANG = "tr";
const BASE_LANGUAGE_LABEL = "Türkçe (TR)";

const makeBlock = (title = "", lines = []) => ({
  title,
  lines,
});

const emptyConfig = {
  heroTitle: "Size yardımcı olmak için buradayız",
  heroSubtitle:
    "Müşteri destek ekibimiz Pazartesi-Cuma günleri 09:00-18:00 saatleri arasında hizmet veriyor. Bize bir mesaj bırakın, en geç bir iş günü içinde yanıtlayalım.",
  heroImage: null,
  addressBlock: makeBlock("Mağazamızı ziyaret edin", [
    OFFICIAL_ADDRESS,
    OFFICIAL_ADDRESS_NOTE,
  ]),
  hoursBlock: makeBlock("Çalışma saatleri", [
    "Pzt – Cum: 09:00 – 18:00",
    "Cmt: 10:00 – 16:00",
    "Paz ve resmi tatiller: kapalı",
  ]),
  emailBlock: makeBlock("Müşteri hizmetleri", [
    OFFICIAL_SUPPORT_EMAIL,
    OFFICIAL_SUPPORT_RESPONSE_NOTE,
  ]),
  phoneBlock: makeBlock("Telefon", [
    OFFICIAL_PHONE,
    OFFICIAL_PHONE_NOTE,
  ]),
  formEnabled: true,
  successMessage:
    "Mesajınız için teşekkür ederiz. Talebinizi aldık ve kısa süre içinde e-posta ile yanıtlayacağız. Hemen destek almak isterseniz aşağıdaki numaradan bizi arayın.",
};

const deepClone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const asString = (value, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const normalizeBlock = (block, fallback) => {
  const safe = block && typeof block === "object" ? block : {};
  return {
    title: asString(safe.title, fallback.title),
    lines: Array.isArray(safe.lines)
      ? safe.lines.map((line) => asString(line))
      : [...fallback.lines],
  };
};

const normalizeState = (raw) => {
  const base = deepClone(emptyConfig);
  if (!raw) return base;

  base.heroTitle = asString(raw.heroTitle, base.heroTitle);
  base.heroSubtitle = asString(raw.heroSubtitle, base.heroSubtitle);
  base.successMessage = asString(raw.successMessage, base.successMessage);
  base.formEnabled =
    raw.formEnabled === undefined ? base.formEnabled : Boolean(raw.formEnabled);

  base.heroImage =
    raw.heroImage && raw.heroImage.url
      ? {
          url: raw.heroImage.url,
          publicId: raw.heroImage.publicId || "",
          width: raw.heroImage.width,
          height: raw.heroImage.height,
          format: raw.heroImage.format,
        }
      : null;

  base.addressBlock = normalizeBlock(
    raw.addressBlock,
    emptyConfig.addressBlock
  );
  base.hoursBlock = normalizeBlock(raw.hoursBlock, emptyConfig.hoursBlock);
  base.emailBlock = normalizeBlock(raw.emailBlock, emptyConfig.emailBlock);
  base.phoneBlock = normalizeBlock(raw.phoneBlock, emptyConfig.phoneBlock);

  return base;
};

const sanitizePayload = (raw) => {
  const formatBlock = (block = {}) => ({
    title: asString(block.title).trim(),
    lines: Array.isArray(block.lines)
      ? block.lines.map((line) => asString(line).trim()).filter(Boolean)
      : [],
  });

  const result = {
    heroTitle: asString(raw.heroTitle),
    heroSubtitle: asString(raw.heroSubtitle),
    successMessage: asString(raw.successMessage),
    formEnabled: Boolean(raw.formEnabled),
    addressBlock: formatBlock(raw.addressBlock),
    hoursBlock: formatBlock(raw.hoursBlock),
    emailBlock: formatBlock(raw.emailBlock),
    phoneBlock: formatBlock(raw.phoneBlock),
    heroImage:
      raw.heroImage && raw.heroImage.url
        ? {
            url: raw.heroImage.url,
            publicId: raw.heroImage.publicId || "",
            width: raw.heroImage.width,
            height: raw.heroImage.height,
            format: raw.heroImage.format,
          }
        : null,
  };

  return result;
};

function getMessage(err) {
  if (!err) return "Beklenmeyen hata";
  if (typeof err === "string") return err;
  if (err.message) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return err.message;
  }
  return String(err);
}

export default function AdminContactSettingsPageInner() {
  const [data, setData] = useState(() => deepClone(emptyConfig));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [banner, setBanner] = useState(null);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    contact: null,
    error: null,
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const conf = await contactPageApi.get(BASE_LANG);
      setData(normalizeState(conf));
      setTranslationState((prev) =>
        prev.open
          ? {
              ...prev,
              contact: conf,
            }
          : prev
      );
    } catch (err) {
      setBanner({ variant: "danger", message: getMessage(err) });
      setData(deepClone(emptyConfig));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const canSave = useMemo(() => !saving && !loading, [saving, loading]);
  const disabled = loading || saving;
  const heroFileInputRef = useRef(null);

  const update = (patch) => setData((prev) => ({ ...prev, ...patch }));

  const updateBlock = (key, updater) => {
    setData((prev) => {
      const current = prev[key] || makeBlock();
      const nextBlock = updater({
        title: current.title ?? "",
        lines: Array.isArray(current.lines) ? [...current.lines] : [],
      });
      return { ...prev, [key]: nextBlock };
    });
  };

  const changeBlockTitle = (key, value) =>
    updateBlock(key, (block) => ({ ...block, title: value }));

  const addLine = (key) =>
    updateBlock(key, (block) => ({
      ...block,
      lines: [...block.lines, ""],
    }));

  const removeLine = (key, index) =>
    updateBlock(key, (block) => {
      const lines = [...block.lines];
      lines.splice(index, 1);
      return { ...block, lines };
    });

  const changeLine = (key, index, value) =>
    updateBlock(key, (block) => {
      const lines = [...block.lines];
      lines[index] = value;
      return { ...block, lines };
    });

  const handleHeroFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setHeroUploading(true);
    try {
      const asset = await mediaApi.upload(file, { folder: "contact/hero" });
      update({ heroImage: asset });
      setBanner({
        variant: "success",
        message: "Hero görseli yüklendi.",
      });
    } catch (err) {
      setBanner({ variant: "danger", message: getMessage(err) });
    } finally {
      setHeroUploading(false);
      event.target.value = "";
    }
  };

  const triggerHeroUpload = () => {
    heroFileInputRef.current?.click();
  };

  const clearHeroImage = () => {
    update({ heroImage: null });
  };

  const save = async () => {
    setSaving(true);
    setBanner(null);
    try {
      const payload = sanitizePayload(data);
      const saved = await contactPageApi.upsert(payload, BASE_LANG);
      setData(normalizeState(saved || payload));
      setBanner({
        variant: "success",
        message: "İletişim sayfası ayarları kaydedildi.",
      });
    } catch (err) {
      setBanner({ variant: "danger", message: getMessage(err) });
    } finally {
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const resetToServer = async () => {
    setBanner(null);
    await loadConfig();
  };

  const openTranslationModal = async () => {
    setTranslationState({
      open: true,
      loading: true,
      contact: null,
      error: null,
    });
    try {
      const conf = await contactPageApi.get(BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        contact: conf,
        error: null,
      });
    } catch (err) {
      setTranslationState({
        open: true,
        loading: false,
        contact: null,
        error: getMessage(err),
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      contact: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadConfig();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            İletişim Sayfası İçeriği
          </h1>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            {HAS_TRANSLATIONS
              ? "Türkçe (varsayılan) içerikleri buradan düzenleyin; diğer diller için “Dil varyantları” butonunu kullanın."
              : "Tüm içerikler Türkçe olarak yönetilir."}
          </p>
        </div>
        {HAS_TRANSLATIONS && (
          <button
            type="button"
            onClick={openTranslationModal}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <Languages className="h-4 w-4" />
            Dil varyantları
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
              <ShieldCheck className="h-4 w-4" />
              İletişim Sayfası
            </div>
            <h2 className="text-2xl font-semibold">İletişim Sayfası İçeriği</h2>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Kahraman metnini, kenar çubuğu bloklarını ve form davranışını düzenleyin.
            </p>
            <p className="rounded-xl border border-[var(--color-border-admin)]/60 bg-[var(--color-bg-admin)]/40 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
              Başlıklar ve metinler{" "}
              <span className="font-semibold text-[var(--color-text-admin)]">
                {BASE_LANGUAGE_LABEL}
              </span>{" "}
              dili için kaydedilir.
            </p>
          </div>

          {banner ? (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm ${
                banner.variant === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : banner.variant === "danger"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] text-[var(--color-text-admin)]"
              }`}
            >
              {banner.message}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-7">
              <Card
                title="Hero Bölümü"
                subtitle="Başlık, giriş metni ve isteğe bağlı hero görseli."
              >
                <Field
                  icon={Type}
                  label="Hero başlığı"
                  value={data.heroTitle}
                  onChange={(value) => update({ heroTitle: value })}
                  placeholder="Size yardımcı olmak için buradayız"
                  disabled={disabled}
                />
                <TextArea
                  icon={Quote}
                  label="Hero alt başlığı"
                  rows={3}
                  value={data.heroSubtitle}
                  onChange={(value) => update({ heroSubtitle: value })}
                  placeholder="İletişim politikanızı anlatan kısa paragraf."
                  disabled={disabled}
                />
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-[var(--color-text-admin)]">
                    Hero görseli (opsiyonel)
                  </label>
                  {data.heroImage ? (
                    <div className="overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-white shadow-sm">
                      <AppImage
                        src={data.heroImage.url}
                        alt="Hero görseli"
                        width={960}
                        height={384}
                        sizes="(max-width: 1024px) 100vw, 960px"
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/40 text-sm text-[var(--color-text-admin-muted)]">
                      Henüz görsel seçilmedi
                    </div>
                  )}
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleHeroFileChange}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={triggerHeroUpload}
                      disabled={disabled || heroUploading}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      {heroUploading ? "Yükleniyor..." : "Görsel Yükle"}
                    </button>
                    {data.heroImage && (
                      <button
                        type="button"
                        onClick={clearHeroImage}
                        disabled={disabled || heroUploading}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Görseli Kaldır
                      </button>
                    )}
                  </div>
                </div>
              </Card>

              <Card
                title="Adres ve Çalışma Saatleri"
                subtitle="Ziyaretçiler için kenar çubuğu bloklarını yapılandırın."
              >
                <Field
                  icon={MapPin}
                  label="Adres blok başlığı"
                  value={data.addressBlock.title}
                  onChange={(value) => changeBlockTitle("addressBlock", value)}
                  placeholder="Avrupa stüdyomuzu ziyaret edin"
                  disabled={disabled}
                />
                <Repeater
                  icon={MapPin}
                  label="Adres satırları"
                  items={data.addressBlock.lines}
                  onAdd={() => addLine("addressBlock")}
                  onRemove={(index) => removeLine("addressBlock", index)}
                  onChange={(index, value) =>
                    changeLine("addressBlock", index, value)
                  }
                  placeholder="Sokak, şehir, ek not..."
                  disabled={disabled}
                />
                <Separator />
                <Field
                  icon={Clock3}
                  label="Çalışma saatleri başlığı"
                  value={data.hoursBlock.title}
                  onChange={(value) => changeBlockTitle("hoursBlock", value)}
                  placeholder="Çalışma saatleri (CET)"
                  disabled={disabled}
                />
                <Repeater
                  icon={Clock3}
                  label="Çalışma saatleri satırları"
                  items={data.hoursBlock.lines}
                  onAdd={() => addLine("hoursBlock")}
                  onRemove={(index) => removeLine("hoursBlock", index)}
                  onChange={(index, value) =>
                    changeLine("hoursBlock", index, value)
                  }
                  placeholder="Pzt – Cum: 09:00 – 18:00"
                  disabled={disabled}
                />
              </Card>
            </div>

            <div className="space-y-6 xl:col-span-5">
              <Card
                title="İletişim Kanalları"
                subtitle="Kenar çubuğunda gösterilen e-posta ve telefon numaraları."
              >
                <Field
                  icon={Mail}
                  label="E-posta blok başlığı"
                  value={data.emailBlock.title}
                  onChange={(value) => changeBlockTitle("emailBlock", value)}
                  placeholder="Müşteri hizmetleri"
                  disabled={disabled}
                />
                <Repeater
                  icon={Mail}
                  label="E-posta satırları"
                  items={data.emailBlock.lines}
                  onAdd={() => addLine("emailBlock")}
                  onRemove={(index) => removeLine("emailBlock", index)}
                  onChange={(index, value) =>
                    changeLine("emailBlock", index, value)
                  }
                  placeholder="destek@domain.com"
                  disabled={disabled}
                />
                <Separator />
                <Field
                  icon={Phone}
                  label="Telefon blok başlığı"
                  value={data.phoneBlock.title}
                  onChange={(value) => changeBlockTitle("phoneBlock", value)}
                  placeholder="Telefon"
                  disabled={disabled}
                />
                <Repeater
                  icon={Phone}
                  label="Telefon satırları"
                  items={data.phoneBlock.lines}
                  onAdd={() => addLine("phoneBlock")}
                  onRemove={(index) => removeLine("phoneBlock", index)}
                  onChange={(index, value) =>
                    changeLine("phoneBlock", index, value)
                  }
                  placeholder="+49 30 123 456 78"
                  disabled={disabled}
                />
              </Card>

              <Card
                title="Form Davranışı"
                subtitle="İletişim formunu açıp kapatın ve onay metnini düzenleyin."
              >
                <ToggleRow
                  label="İletişim formunu etkinleştir"
                  checked={Boolean(data.formEnabled)}
                  onChange={(value) => update({ formEnabled: value })}
                  disabled={saving}
                />
                <TextArea
                  icon={Send}
                  label="Başarı mesajı"
                  rows={4}
                  value={data.successMessage}
                  onChange={(value) => update({ successMessage: value })}
                  placeholder="Başarılı form gönderiminden sonra gösterilir."
                  disabled={disabled}
                />
              </Card>

              <Card
                title="Hızlı Önizleme"
                subtitle="Sağ kenar çubuğunun canlı görünümü."
              >
                <PreviewSidebar data={data} />
              </Card>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border-admin)] pt-4">
            <button
              type="button"
              onClick={resetToServer}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Sıfırla
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2.5 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </span>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Değişiklikleri kaydet
                </>
              )}
            </button>
          </div>
        </div>
      </div>

        <aside className="xl:col-span-4">
          <div className="sticky top-20 space-y-6">
            <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
              <h3 className="text-lg font-semibold">İçerik ipuçları</h3>
              <ul className="mt-4 space-y-2 text-sm text-[var(--color-text-admin-muted)]">
                <li>Kolay okunabilirlik için hero metnini 140 karakterin altında tutun.</li>
                <li>Adres satırlarını mantıklı şekilde birleştirin ve tekrarları önleyin.</li>
                <li>En hızlı destek kanalını ilk satırda vurgulayın.</li>
                <li>Başarı mesajı net yanıt beklentisi oluşturmalıdır.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {HAS_TRANSLATIONS && (
        <ContactTranslationModal
          open={translationState.open}
          loading={translationState.loading}
          error={translationState.error}
          contact={translationState.contact}
          baseLang={BASE_LANG}
          langs={TRANSLATION_LANGS}
          onClose={closeTranslationModal}
          onUpdated={handleTranslationsUpdated}
        />
      )}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/50 p-5">
      <header className="mb-4 space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle ? (
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            {subtitle}
          </p>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Label({ children }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
      {children}
    </label>
  );
}

function Field({ icon: Icon, label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <Label>{label}</Label>
      </div>
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
      />
    </div>
  );
}

function TextArea({
  icon: Icon,
  label,
  rows = 3,
  value,
  onChange,
  placeholder,
  disabled,
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <Label>{label}</Label>
      </div>
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
      />
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="text-sm font-medium text-[var(--color-text-admin)]">
        {label}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => (disabled ? null : onChange?.(!checked))}
        className={`h-6 w-11 rounded-full transition ${
          checked ? "bg-accent" : "bg-[var(--color-border-admin)]"
        } relative`}
        disabled={disabled}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function Repeater({
  icon: Icon,
  label,
  items = [],
  onAdd,
  onRemove,
  onChange,
  placeholder,
  disabled,
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <Label>{label}</Label>
        </div>
        <button
          type="button"
          onClick={() => (disabled ? null : onAdd?.())}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
          disabled={disabled}
        >
          + Ekle
        </button>
      </div>

      <div className="space-y-2">
        {(items || []).map((val, index) => (
          <div
            key={`${label}-${index}`}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2"
          >
            <input
              type="text"
              value={val ?? ""}
              onChange={(event) => onChange?.(index, event.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
            />
            <button
              type="button"
              onClick={() => (disabled ? null : onRemove?.(index))}
              className="rounded-full border border-rose-300 p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              aria-label="Kaldır"
              title="Kaldır"
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!items?.length ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border-admin)] p-3 text-center text-xs text-[var(--color-text-admin-muted)]">
            Henüz öğe yok
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Separator() {
  return <div className="my-3 h-px w-full bg-[var(--color-border-admin)]/60" />;
}

function PreviewSidebar({ data }) {
  const blocks = [
    {
      icon: MapPin,
      title: data.addressBlock.title || emptyConfig.addressBlock.title,
      items: data.addressBlock.lines,
    },
    {
      icon: Clock3,
      title: data.hoursBlock.title || emptyConfig.hoursBlock.title,
      items: data.hoursBlock.lines,
    },
    {
      icon: Mail,
      title: data.emailBlock.title || emptyConfig.emailBlock.title,
      items: data.emailBlock.lines,
    },
    {
      icon: Phone,
      title: data.phoneBlock.title || emptyConfig.phoneBlock.title,
      items: data.phoneBlock.lines,
    },
  ];

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <PreviewCard
          key={`${block.title}-${index}`}
          icon={block.icon}
          title={block.title}
          items={block.items}
        />
      ))}
    </div>
  );
}

function PreviewCard({ icon: IconComponent, title, items = [] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-[var(--color-text-admin)]">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/10 text-accent">
          {IconComponent ? <IconComponent className="h-4 w-4" /> : null}
        </span>
        <div className="font-serif text-base font-semibold">{title}</div>
      </div>
      <ul className="space-y-1 text-sm text-[var(--color-text-admin-muted)]">
        {(items || []).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
        {!items?.length ? <li>—</li> : null}
      </ul>
    </div>
  );
}
