import {
  OFFICIAL_ADDRESS,
  OFFICIAL_PHONE,
  OFFICIAL_SUPPORT_EMAIL,
} from "../../config/siteContact.js";

export default function MaintenanceModeScreen() {
  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#ffffff_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-sky-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(12,74,110,0.12)] sm:px-10">
          <div className="mx-auto inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            CepLife Bakım Modu
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Sitemiz bakımdadır
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            En kısa zamanda yeniden yayında olacağız. Bu süreçte mağaza arayüzü geçici olarak erişime kapatılmıştır.
          </p>

          <div className="mt-10 rounded-[28px] border border-slate-200 bg-slate-50/70 p-6 text-left">
            <div className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              İletişim
            </div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700 sm:text-base">
              <div>
                <span className="font-semibold text-slate-900">E-posta:</span>{" "}
                {OFFICIAL_SUPPORT_EMAIL}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Telefon:</span>{" "}
                {OFFICIAL_PHONE}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Adres:</span>{" "}
                {OFFICIAL_ADDRESS}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
