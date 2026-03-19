import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { heroApi } from "../../api/heroes";
import { campaignApi } from "../../api/campaigns";
import ShippingSettingsCard from "./settings/ShippingSettingsCard.jsx";
import ReviewSettingsCard from "./settings/ReviewSettingsCard.jsx";
import AppImage from "../ui/AppImage.jsx";
import {
  Wand2,
  ArrowRight,
  Image as ImageIcon,
  Video,
  Palette,
  Megaphone,
  FileText,
  Mail,
  HelpCircle,
  Truck,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";

function SectionBlock({ title, subtitle, children }) {
  return (
    <section className="mt-8">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>
    </section>
  );
}

function SettingsCard({
  to,
  icon: Icon,
  mediaIcon: MediaIcon,
  mediaImage,
  mediaAlt = "",
  title,
  description,
  footer,
  media,
  loading = false,
}) {
  const Wrapper = to ? Link : "div";
  const wrapperProps = to ? { to } : {};

  const cover = loading ? (
    <div className="h-full w-full animate-pulse bg-[var(--color-bg-hover)]" />
  ) : media ? (
    media
  ) : mediaImage ? (
    <AppImage
      src={mediaImage}
      alt={mediaAlt || title}
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      className="h-full w-full object-cover"
    />
  ) : MediaIcon ? (
    <div className="relative h-full w-full bg-gradient-to-br from-[var(--color-surface-light)] via-[var(--color-surface)] to-[var(--color-surface-hover)]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid h-24 w-24 place-items-center rounded-2xl bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/30 backdrop-blur-md">
          <MediaIcon className="h-12 w-12 text-[var(--color-accent)]" />
        </div>
      </div>
    </div>
  ) : (
    <div className="grid h-full place-items-center text-[var(--color-text-admin-muted)]">
      <LayoutDashboard className="h-6 w-6" />
    </div>
  );

  return (
    <Wrapper
      {...wrapperProps}
      className={[
        "group relative overflow-hidden rounded-2xl border",
        "border-[var(--color-border-admin)]",
        to
          ? "bg-[var(--color-bg-admin)] hover:bg-[var(--color-bg-card)] transition-colors"
          : "bg-[var(--color-bg-admin)]",
      ].join(" ")}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {cover}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent" />
      </div>

      {/* İçerik */}
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/30">
            {Icon ? (
              <Icon className="h-6 w-6 text-[var(--color-accent)]" />
            ) : (
              <Wand2 className="h-6 w-6 text-[var(--color-accent)]" />
            )}
          </div>
          <div>
            <div className="font-semibold text-[var(--color-text-admin)]">
              {title}
            </div>
            {description && (
              <div className="text-xs text-[var(--color-text-admin-muted)]">
                {description}
              </div>
            )}
          </div>
        </div>

        {to && (
          <div className="rounded-full border border-[var(--color-border-admin)] p-2 group-hover:bg-[var(--color-bg-hover)]">
            <ArrowRight className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          </div>
        )}
      </div>

      {footer && <div className="px-4 pb-4">{footer}</div>}
    </Wrapper>
  );
}

/* ------------------------------------------------------------------ */
export default function AdminSettingsPageInner() {
  const [heroes, setHeroes] = useState([]);
  const [loadingHeroes, setLoadingHeroes] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const topHero = useMemo(
    () =>
      [...heroes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] ||
      null,
    [heroes]
  );

  const topCampaign = useMemo(
    () =>
      [...campaigns].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      )[0] || null,
    [campaigns]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [heroList, campaignList] = await Promise.all([
          heroApi.list({ includeInactive: true }),
          campaignApi.listManage({ includeInactive: true }),
        ]);
        if (!mounted) return;
        setHeroes(heroList);
        setCampaigns(campaignList);
      } finally {
        if (mounted) {
          setLoadingHeroes(false);
          setLoadingCampaigns(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-1 gap-6 xl:grid-cols-12 auto-rows-fr">
      <div className="xl:col-span-12 h-full flex flex-col">
        <div className="flex h-full flex-col rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          {/* Başlık */}
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
              <Wand2 className="h-4 w-4" />
              Genel Ayarlar
            </div>
            <h2 className="text-2xl font-semibold">
              Site Ayarları & İçerik Blokları
            </h2>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Ana sayfa bannerlarını, kampanyaları, sayfa içeriklerini,
              politikaları ve hızlı ayarları yönetin.
            </p>
          </div>

          {/* --- Kategoriler --- */}
          <SectionBlock
            title="Ana Sayfa & Pazarlama"
            subtitle="Hero ve kampanya içeriklerini yönetin."
          >
            <SettingsCard
              to="/admin/settings/hero"
              icon={topHero?.video ? Video : ImageIcon}
              mediaImage={
                !loadingHeroes && topHero?.image?.url
                  ? topHero.image.url
                  : undefined
              }
              mediaIcon={
                !loadingHeroes && !topHero?.image?.url
                  ? topHero?.video
                    ? Video
                    : ImageIcon
                  : undefined
              }
              mediaAlt={topHero?.title || "Ana Sayfa Hero"}
              title="Ana Sayfa Hero"
              description={
                heroes.length
                  ? `${heroes.length} slayt • en üstte: ${
                      topHero?.title || "—"
                    }`
                  : "İlk hero slaytını oluştur"
              }
              loading={loadingHeroes}
            />

            <SettingsCard
              to="/admin/campaigns"
              icon={Megaphone}
              mediaImage={
                !loadingCampaigns && topCampaign?.image?.url
                  ? topCampaign.image.url
                  : undefined
              }
              mediaIcon={
                !loadingCampaigns && !topCampaign?.image?.url
                  ? Megaphone
                  : undefined
              }
              mediaAlt={topCampaign?.name || "Ana Sayfa Kampanyaları"}
              title="Ana Sayfa Kampanyaları"
              description={
                campaigns.length
                  ? `${campaigns.length} toplam • en üstte: ${
                      topCampaign?.name || "—"
                    }`
                  : "İlk kampanyayı oluştur"
              }
              loading={loadingCampaigns}
            />
          </SectionBlock>

          <SectionBlock
            title="Sayfalar"
            subtitle="Statik sayfa içeriklerini düzenleyin."
          >
            <SettingsCard
              to="/admin/settings/about"
              icon={FileText}
              mediaIcon={FileText}
              title="Hakkında Sayfası"
            />
            <SettingsCard
              to="/admin/settings/contact"
              icon={Mail}
              mediaIcon={Mail}
              title="İletişim Sayfası"
            />
            <SettingsCard
              to="/admin/settings/faq"
              icon={HelpCircle}
              mediaIcon={HelpCircle}
              title="SSS (Sık Sorulan Sorular)"
            />
            <SettingsCard
              to="/admin/settings/shipping-returns"
              icon={Truck}
              mediaIcon={Truck}
              title="Kargo & İade"
            />
          </SectionBlock>

          <SectionBlock title="Politikalar" subtitle="Yasal metinleri yönetin.">
            <SettingsCard
              to="/admin/settings/privacy"
              icon={ShieldCheck}
              mediaIcon={ShieldCheck}
              title="Gizlilik Politikası"
            />
            <SettingsCard
              to="/admin/settings/terms"
              icon={FileText}
              mediaIcon={FileText}
              title="Kullanım Şartları"
            />
          </SectionBlock>

          <SectionBlock
            title="Hızlı & Eski Ayarlar"
            subtitle="Geçiş dönemine ait küçük ayarlar."
          >
            <div className="col-span-1 md:col-span-2">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ShippingSettingsCard />
                <ReviewSettingsCard />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock
            title="Görünüm"
            subtitle="Tema ve renk ayarları (yakında)."
          >
            <SettingsCard
              to="/admin/settings/theme"
              icon={Palette}
              mediaIcon={Palette}
              title="Tema & Renkler"
              description="(yakında) Renk paletini düzenle"
            />
          </SectionBlock>
        </div>
      </div>

      {/* İpuçları
      <aside className="xl:col-span-4">
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <h3 className="text-lg font-semibold">İpuçları</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--color-text-admin-muted)]">
            <li>
              Hero alanı için kısa ve optimize edilmiş videolar tercih edin.
            </li>
            <li>Buton metni isteğe bağlıdır; sade tasarım en iyisidir.</li>
            <li>Hedef tüm mağaza veya belirli kategoriler olabilir.</li>
            <li>Sıralama numarası slayt sırasını belirler.</li>
            <li>Hakkında, İletişim, SSS ve Kargo sayfalarını açık tutun.</li>
          </ul>
        </div>
      </aside> */}
    </div>
  );
}
