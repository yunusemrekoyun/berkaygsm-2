import { connectDB } from "../server/config/db.js";
import Product from "../server/models/Product.js";
import Set from "../server/models/Set.js";
import Category from "../server/models/Category.js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ceplife.com";

const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" },
  { path: "/sets", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.4, changeFrequency: "monthly" },
  { path: "/shipping-returns", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap() {
  const staticEntries = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  try {
    await connectDB();

    const [products, sets, categories] = await Promise.all([
      Product.find({ isActive: true, listedInCatalog: true })
        .select("slug updatedAt")
        .lean(),
      Set.find({ isActive: true })
        .select("slug updatedAt")
        .lean(),
      Category.find({ isActive: true })
        .select("slug updatedAt")
        .lean(),
    ]);

    const productEntries = products.map((p) => ({
      url: `${SITE_URL}/product/${p.slug}`,
      lastModified: p.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const setEntries = sets.map((s) => ({
      url: `${SITE_URL}/set/${s.slug}`,
      lastModified: s.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const categoryEntries = categories.map((c) => ({
      url: `${SITE_URL}/shop?category=${c.slug}`,
      lastModified: c.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticEntries, ...productEntries, ...setEntries, ...categoryEntries];
  } catch {
    return staticEntries;
  }
}
