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

const nextConfig = {
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
};

export default nextConfig;
