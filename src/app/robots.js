const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ceplife.com";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/checkout/success"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
