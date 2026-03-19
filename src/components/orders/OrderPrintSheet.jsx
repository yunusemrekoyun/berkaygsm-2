import AppImage from "../ui/AppImage.jsx";

export default function OrderPrintSheet({ model, previewRef = null }) {
  if (!model) return null;

  return (
    <div
      ref={previewRef}
      className="mx-auto flex aspect-[2/3] w-full max-w-[340px] flex-col overflow-hidden rounded-[24px] border border-stone-300 bg-white p-4 text-stone-900 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:max-w-[360px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-stone-400">
            Kutu Etiketi
          </span>
          <div className="relative h-9 w-24">
            <AppImage
              src={model.logoSrc}
              alt="Logo"
              fill
              priority
              sizes="112px"
              className="object-contain object-left"
            />
          </div>
        </div>

        <div className="text-right">
          <div className="text-base font-bold tracking-tight text-stone-950 sm:text-lg">
            {model.orderNumber}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {model.createdAtLabel}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2.5 text-[12px]">
        <section className="rounded-[18px] border border-stone-200 bg-stone-50/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
            Alıcı
          </div>
          <div className="mt-1.5 text-[15px] font-bold leading-5 text-stone-950">
            {model.customerName}
          </div>
          <div className="mt-1 text-[13px] text-stone-600">{model.phone}</div>
        </section>

        <section className="rounded-[18px] border border-stone-200 bg-stone-50/60 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
            Adres
          </div>
          <div className="mt-1.5 space-y-1 text-[12.5px] leading-[1.35] text-stone-700">
            {model.addressLineParts.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-stone-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              Ürünler
            </div>
            <div className="text-xs font-medium text-stone-500">
              {model.itemCount} adet
            </div>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {model.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto] gap-2 border-b border-dashed border-stone-200 pb-2.5 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-[1.3] text-stone-950">
                    {item.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-500">
                    {item.qty} adet • {item.unitPriceLabel}
                  </div>
                  {item.variantSummary && (
                    <div className="mt-0.5 text-[11px] leading-[1.3] text-stone-500">
                      {item.variantSummary}
                    </div>
                  )}
                  {item.selectionLines.length > 0 && (
                    <div className="mt-0.5 space-y-0.5 text-[11px] leading-[1.3] text-stone-500">
                      {item.selectionLines.map((line, index) => (
                        <div key={`${item.id}-selection-${index}`}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="whitespace-nowrap text-[13px] font-bold text-stone-950">
                  {item.lineTotalLabel}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-stone-200 bg-stone-50/70 p-3">
          <div className="space-y-1.5 text-[12.5px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-stone-500">Ara Toplam</span>
              <span className="font-medium text-stone-900">
                {model.subtotalLabel}
              </span>
            </div>
            {model.adjustments.map((adjustment) => (
              <div
                key={`${adjustment.label}-${adjustment.valueLabel}`}
                className="flex items-center justify-between gap-3 text-amber-700"
              >
                <span>{adjustment.label}</span>
                <span className="font-medium">{adjustment.valueLabel}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <span className="text-stone-500">{model.shippingName}</span>
              <span className="font-medium text-stone-900">
                {model.shippingLabel}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-2 text-[15px] font-bold text-stone-950">
              <span>Genel Toplam</span>
              <span>{model.totalLabel}</span>
            </div>
          </div>
        </section>

        {model.note && (
          <section className="rounded-[18px] border border-stone-200 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
              Sipariş Notu
            </div>
            <div className="mt-1.5 whitespace-pre-wrap text-[12px] leading-[1.35] text-stone-700">
              {model.note}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
