import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import AppImage from "../../ui/AppImage.jsx";

export default function CategoryForm({
  category,
  parentOptions = [],
  onSubmit,
  onDelete,
  submitting = false,
  loading = false,
  onCancelEdit,
}) {
  const isEditing = Boolean(category?.id);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(category?.name ?? "");
    setParent(category?.parent ?? "");
    setRemoveImage(false);
    setImageFile(null);
    setPreviewUrl("");
    setError("");
  }, [category]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  const parentHelper = useMemo(() => {
    if (!category) {
      return "Bu kategorinin nerede yer alacağını seçin (opsiyonel).";
    }
    if (category.level === 0) {
      return "Bu üst seviye bir kategoridir. Başka bir kök altına da yerleştirebilirsiniz.";
    }
    if (category.level === 1) {
      return "Bu ikinci seviye bir kategoridir. Yükseltebilir veya indirebilirsiniz.";
    }
    return "Yaprak kategorilerin alt kategorisi olamaz.";
  }, [category]);

  const existingImageSrc = category?.image?.url || "";
  const hasExistingImage = Boolean(existingImageSrc) && !removeImage;
  const hasNewImagePreview = Boolean(previewUrl);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Kategori adı zorunludur");
      return;
    }

    setError("");

    const payload = {
      name: name.trim(),
      parent: parent || "",
    };

    if (imageFile) {
      payload.image = imageFile;
    }

    if (isEditing && removeImage && !imageFile) {
      payload.removeImage = true;
    }

    await onSubmit?.(payload);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Lütfen bir görsel dosyası yükleyin");
      return;
    }

    setError("");
    setImageFile(file);
    setRemoveImage(false);
  };

  const handleCancelNewFile = () => {
    setImageFile(null);
  };

  const handleRemoveExisting = () => {
    if (!isEditing || !category?.image) return;
    setImageFile(null);
    setPreviewUrl("");
    setRemoveImage(true);
  };

  const handleClearImage = () => {
    if (hasNewImagePreview) {
      handleCancelNewFile();
      return;
    }

    if (hasExistingImage) {
      handleRemoveExisting();
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-admin)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        {" "}
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-admin)]">
            {isEditing ? "Kategoriyi Düzenle" : "Kategori Oluştur"}
          </h3>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            {isEditing
              ? "Kategori adını, hiyerarşisini veya küçük görselini güncelleyin."
              : "Kataloğun herhangi bir seviyesine yeni bir kategori ekleyin."}
          </p>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex w-full items-center justify-center rounded-full border border-[var(--color-border-admin)] px-3 py-2 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] sm:w-auto sm:py-1"
          >
            Yeni oluştur
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5 sm:px-5">
        {" "}
        {loading ? (
          <div className="space-y-3">
            <div className="h-11 animate-pulse rounded-xl bg-[var(--color-bg-hover)]" />
            <div className="h-11 animate-pulse rounded-xl bg-[var(--color-bg-hover)]" />
            <div className="h-32 animate-pulse rounded-xl bg-[var(--color-bg-hover)]" />
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                Kategori adı
                <span className="text-[var(--color-accent)]">*</span>
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                placeholder="örn. Kılıf"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                Üst kategori
              </span>
              <select
                value={parent || ""}
                onChange={(event) => setParent(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              >
                <option value="">Üst kategori yok (kök)</option>
                {parentOptions.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={option.disabled}
                  >
                    {"".padStart(option.level * 3, " ")}
                    {option.level > 0 ? "• " : ""}
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                {parentHelper}
              </p>
            </label>

            <div>
              <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                Küçük görsel
              </span>
              <p className="mb-2 text-xs text-[var(--color-text-admin-muted)]">
                Katalog menülerinde kullanılan, opsiyonel 1:1 kapak. PNG veya
                JPG, en fazla 2MB.
              </p>

              <div className="flex flex-wrap items-start gap-3">
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border-admin)] px-4 py-3 text-sm text-[var(--color-text-admin)] hover:border-[var(--color-text-admin)] sm:w-auto">
                  {" "}
                  <Upload className="h-4 w-4" />
                  Görsel yükle
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>

                {(hasNewImagePreview || hasExistingImage) && (
                  <div className="relative overflow-hidden rounded-xl border border-[var(--color-border-admin)]">
                    <AppImage
                      src={hasNewImagePreview ? previewUrl : existingImageSrc}
                      alt={
                        hasNewImagePreview
                          ? "Yeni görsel önizleme"
                          : category?.name || "Kategori görseli"
                      }
                      width={96}
                      height={96}
                      sizes="96px"
                      className="h-24 w-24 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-xs font-semibold text-white"
                    >
                      Kaldır
                    </button>
                  </div>
                )}

                {!hasNewImagePreview && !hasExistingImage && (
                  <div className="grid h-24 w-24 place-items-center rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-hover)] text-[var(--color-text-admin-muted)]">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}

                {removeImage && !imageFile && (
                  <span className="inline-flex items-center rounded-full bg-[var(--color-bg-hover)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)]">
                    Görsel kaldırılacak
                  </span>
                )}
              </div>
            </div>
          </>
        )}
        {error && (
          <div className="rounded-xl bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-accent)]">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {isEditing && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Sil
            </button>
          )}

          <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60 sm:w-auto"
            >
              {submitting
                ? "Kaydediliyor..."
                : isEditing
                  ? "Değişiklikleri kaydet"
                  : "Kategori oluştur"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
