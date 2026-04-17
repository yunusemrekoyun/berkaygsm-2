import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Sayfa Bulunamadı — CepLife",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-20 text-center">
      {/* Logo */}
      <Link href="/" className="mb-10 inline-flex items-center justify-center">
        <Image
          src="/ceplife-logo-cropped.png"
          alt="CepLife"
          width={520}
          height={250}
          className="h-10 w-auto max-w-[180px] object-contain sm:h-12 sm:max-w-[210px]"
          priority
        />
      </Link>

      {/* 404 */}
      <div className="mb-4 font-serif text-[7rem] font-semibold leading-none tracking-tight text-accent/30 sm:text-[10rem]">
        404
      </div>

      <h1 className="mb-3 text-2xl font-semibold text-primary sm:text-3xl">
        Sayfa bulunamadı
      </h1>
      <p className="mb-10 max-w-sm text-base leading-relaxed text-secondary">
        Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"
        >
          Ana sayfaya dön
        </Link>
        <Link
          href="/shop"
          className="rounded-full border border-border bg-white px-6 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-surface-light"
        >
          Ürünlere göz at
        </Link>
      </div>
    </div>
  );
}
