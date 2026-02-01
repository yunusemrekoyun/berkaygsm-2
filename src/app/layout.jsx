import "./globals.css";
import Providers from "./providers.jsx";

export const metadata = {
  title: "Ayyıldız İç Giyim",
  description: "Ayyıldız İç Giyim storefront and admin",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
