import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const routerDomAlias = path.resolve(
  __dirname,
  "src/lib/next-router-dom.js"
);
const turbopackAlias = {
  "react-router-dom": "./src/lib/next-router-dom.js",
};

const securityHeaders = (() => {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://www.google.com https://maps.googleapis.com https://maps.gstatic.com",
    "media-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
    "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://www.google.com https://maps.googleapis.com https://maps.gstatic.com https://challenges.cloudflare.com https://vitals.vercel-insights.com",
    "frame-src 'self' https://www.google.com https://maps.google.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
  ].join("; ");

  const headers = [
    {
      key: "Content-Security-Policy",
      value: csp.replace(/\s{2,}/g, " ").trim(),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), usb=()",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
})();

const nextConfig = {
  poweredByHeader: false,
  experimental: {
    externalDir: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "http",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  turbopack: {
    resolveAlias: turbopackAlias,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "react-router-dom": routerDomAlias,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
