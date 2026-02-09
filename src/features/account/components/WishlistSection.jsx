import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import AppImage from "../../../components/ui/AppImage.jsx";

function WishlistCard({ title, price, image, href, onRemove, copy = {} }) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-white">
      <Link to={href} className="block">
        <div className="aspect-[4/5] w-full overflow-hidden bg-surface">
          {image ? (
            <AppImage
              src={image}
              alt={title}
              width={1200}
              height={1500}
              sizes="(max-width: 768px) 50vw, 25vw"
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center text-secondary/70">
              {copy.noImage || "Görsel yok"}
            </div>
          )}
        </div>
      </Link>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-primary">
            {title}
          </div>
          <div className="text-xs text-secondary">
            ₺{Number(price || 0).toFixed(2)}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover"
          title={copy.remove || "Favorilerden çıkar"}
        >
          <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
        </button>
      </div>
    </div>
  );
}

export default function WishlistSection({ favorites, onToggle, copy = {} }) {
  const products = favorites?.products || [];
  const sets = favorites?.sets || [];
  const hasItems = products.length || sets.length;

  if (!hasItems) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Favoriler"}
        </h2>
        <p className="mt-2 text-secondary">
          {copy.empty || "Favori listeniz şimdilik boş."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-primary">
        {copy.heading || "Favoriler"}
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((item) => (
          <WishlistCard
            key={item.id}
            title={item.name}
            price={item.price}
            image={item.images?.[0]?.url}
            href={`/product/${item.slug || item.id}`}
            onRemove={() => onToggle("product", item.id || item._id || item)}
            copy={copy}
          />
        ))}
        {sets.map((item) => (
          <WishlistCard
            key={item.id}
            title={item.name}
            price={item.price}
            image={item.images?.[0]?.url}
            href={`/set/${item.slug || item.id}`}
            onRemove={() => onToggle("set", item.id || item._id || item)}
            copy={copy}
          />
        ))}
      </div>
    </div>
  );
}
