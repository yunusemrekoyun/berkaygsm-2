export const COLOR_PALETTE = [
  {
    name: "Black",
    value: "#000000",
    labels: { en: "Black", tr: "Siyah", de: "Schwarz" },
  },
  {
    name: "Charcoal",
    value: "#333333",
    labels: { en: "Charcoal", tr: "Kömür Grisi", de: "Anthrazit" },
  },
  {
    name: "White",
    value: "#FFFFFF",
    labels: { en: "White", tr: "Beyaz", de: "Weiß" },
  },
  {
    name: "Ivory",
    value: "#F8F4E3",
    labels: { en: "Ivory", tr: "Fildişi", de: "Elfenbein" },
  },
  {
    name: "Silver",
    value: "#C0C0C0",
    labels: { en: "Silver", tr: "Gümüş", de: "Silber" },
  },
  {
    name: "Gold",
    value: "#D4AF37",
    labels: { en: "Gold", tr: "Altın", de: "Gold" },
  },
  {
    name: "Champagne",
    value: "#F7E7CE",
    labels: { en: "Champagne", tr: "Şampanya", de: "Champagner" },
  },
  {
    name: "Taupe",
    value: "#8B7650",
    labels: { en: "Taupe", tr: "Taupe", de: "Taupe" },
  },
  {
    name: "Chocolate",
    value: "#7B3F00",
    labels: { en: "Chocolate", tr: "Çikolata", de: "Schokolade" },
  },
  {
    name: "Terracotta",
    value: "#D86C4B",
    labels: { en: "Terracotta", tr: "Terrakota", de: "Terrakotta" },
  },
  {
    name: "Tangerine",
    value: "#FF7F32",
    labels: { en: "Tangerine", tr: "Mandalina", de: "Mandarine" },
  },
  {
    name: "Sunflower",
    value: "#FFC300",
    labels: { en: "Sunflower", tr: "Ayçiçeği", de: "Sonnenblume" },
  },
  {
    name: "Olive",
    value: "#808000",
    labels: { en: "Olive", tr: "Zeytin Yeşili", de: "Olive" },
  },
  {
    name: "Emerald",
    value: "#2ECC71",
    labels: { en: "Emerald", tr: "Zümrüt", de: "Smaragd" },
  },
  {
    name: "Teal",
    value: "#1ABC9C",
    labels: { en: "Teal", tr: "Deniz Mavisi", de: "Petrol" },
  },
  {
    name: "Seafoam",
    value: "#7FD1AE",
    labels: { en: "Seafoam", tr: "Deniz Köpüğü", de: "Seegrün" },
  },
  {
    name: "Sky Blue",
    value: "#87CEEB",
    labels: { en: "Sky Blue", tr: "Gökyüzü Mavisi", de: "Himmelblau" },
  },
  {
    name: "Royal Blue",
    value: "#4169E1",
    labels: { en: "Royal Blue", tr: "Kraliyet Mavisi", de: "Royalblau" },
  },
  {
    name: "Navy",
    value: "#1C3151",
    labels: { en: "Navy", tr: "Lacivert", de: "Marineblau" },
  },
  {
    name: "Lavender",
    value: "#B497BD",
    labels: { en: "Lavender", tr: "Lavanta", de: "Lavendel" },
  },
  {
    name: "Lilac",
    value: "#C8A2C8",
    labels: { en: "Lilac", tr: "Leylak", de: "Flieder" },
  },
  {
    name: "Fuchsia",
    value: "#C2185B",
    labels: { en: "Fuchsia", tr: "Fuşya", de: "Fuchsie" },
  },
  {
    name: "Blush Pink",
    value: "#F4C2C2",
    labels: { en: "Blush Pink", tr: "Pudra Pembe", de: "Blassrosa" },
  },
  {
    name: "Coral",
    value: "#FF6F61",
    labels: { en: "Coral", tr: "Mercan", de: "Koralle" },
  },
  {
    name: "Crimson",
    value: "#B80F0A",
    labels: { en: "Crimson", tr: "Koyu Kırmızı", de: "Karminrot" },
  },
];

export const COLOR_VALUE_LOOKUP = new Map(
  COLOR_PALETTE.map((entry) => [entry.value.toUpperCase(), entry])
);

function buildNameLookup(entries) {
  const lookup = new Map();
  entries.forEach((entry) => {
    const labels = new Set();
    if (entry.name) labels.add(entry.name);
    if (entry.labels) {
      Object.values(entry.labels).forEach((label) => {
        if (label) labels.add(label);
      });
    }
    labels.forEach((label) => {
      lookup.set(label.toLowerCase(), entry);
    });
  });
  return lookup;
}

export const COLOR_NAME_LOOKUP = buildNameLookup(COLOR_PALETTE);
