import AppImage from "../ui/AppImage.jsx";

function MetaRow({ label, value, full = false }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold leading-[1.35] text-stone-900">
        {value || "-"}
      </div>
    </div>
  );
}

export default function OrderPrintSheet({ model, previewRef = null }) {
  if (!model) return null;

  return (
    <div
      ref={previewRef}
      className="mx-auto flex aspect-[2/3] w-full max-w-[360px] flex-col overflow-hidden rounded-[12px] border border-stone-950 bg-white text-stone-950 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
    >
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3 border-b border-stone-950 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-24">
              <AppImage
                src={model.logoSrc}
                alt="ceplife"
                fill
                priority
                sizes="96px"
                className="object-contain object-left grayscale contrast-200"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                Musteri Fisi
              </div>
              <div className="mt-1 text-sm font-bold text-stone-950">
                {model.brandName}
              </div>
            </div>
          </div>
          <div className="rounded-[6px] border border-stone-950 bg-white px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] text-stone-400">
              Siparis No
            </div>
            <div className="mt-1 text-sm font-bold text-stone-950">
              {model.orderNumber}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-[6px] border border-stone-950 px-3 py-3">
          <div className="space-y-0.5 text-[14px] font-bold leading-[1.25] text-stone-950">
            {(model.sloganLines || [model.receiptConfig?.slogan]).map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
          <div className="mt-2 space-y-0.5 text-[11px] leading-[1.4] text-stone-800">
            {(model.messageLines || [model.receiptConfig?.message]).map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <section className="rounded-[6px] border border-stone-950 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
              Takip Bilgileri
            </div>
            <div className="mt-3 space-y-2.5">
              <MetaRow label="Siparis No" value={model.orderNumber} />
              <MetaRow label="Referans" value={model.referenceCode} />
              <MetaRow label="Olusturma" value={model.createdAtLabel} />
              <MetaRow label="Alim Tarihi" value={model.pickupDateLabel} />
            </div>
          </section>

          <section className="rounded-[6px] border border-stone-950 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
              Diger Secenekler
            </div>
            <div className="mt-3 space-y-2.5">
              <MetaRow label="Teslim Sekli" value={model.deliveryTypeLabel} />
              <MetaRow label="Odeme Sekli" value={model.shippingPayerLabel} />
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-stone-400">
                  SMS Secenekleri
                </div>
                <div className="mt-1.5 space-y-1 text-[12px] leading-[1.35] text-stone-900">
                  {model.smsOptions?.map((item) => (
                    <div key={item} className="flex gap-2">
                      <span className="font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[6px] border border-stone-950 bg-white p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
            Alici Bilgileri
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MetaRow label="Alici Adi" value={model.recipientFirstName} />
            <MetaRow label="Alici Soyadi" value={model.recipientLastName} />
            <MetaRow label="Cep Telefonu" value={model.phone} />
            <MetaRow label="E-posta" value={model.email} />
            <MetaRow label="Teslimat Adresi" value={model.addressText} full />
          </div>
        </section>

        {model.note ? (
          <section className="rounded-[6px] border border-stone-950 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
              Teslim Notu
            </div>
            <div className="mt-2 space-y-1 text-[12px] leading-[1.45] text-stone-700">
              {model.noteLines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-auto rounded-[6px] border border-stone-950 bg-white p-3 text-stone-950">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="font-semibold uppercase tracking-[0.16em] text-stone-500">
              E-posta
            </span>
            <span className="break-all">{model.supportEmail}</span>
          </div>
          <div className="mt-2 text-[12px] text-stone-900">{model.supportPhone}</div>
          <div className="mt-3 space-y-1 border-t border-stone-950 pt-2 text-[11px] text-stone-700">
            <div>Instagram: {model.receiptConfig?.instagramUrl}</div>
            <div>TikTok: {model.receiptConfig?.tiktokUrl}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
