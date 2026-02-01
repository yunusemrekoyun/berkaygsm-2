import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

function WishlistCard({ title, price, image, href, onRemove, copy = {} }) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-white">
      <Link to={href} className="block">
        <div className="aspect-square w-full overflow-hidden bg-surface">
          {image ? (
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="grid h-full place-items-center text-secondary/70">
              {copy.noImage || "No image"}
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
            €{Number(price || 0).toFixed(2)}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover"
          title={copy.remove || "Remove from wishlist"}
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
          {copy.heading || "Wishlist"}
        </h2>
        <p className="mt-2 text-secondary">
          {copy.empty || "Your wishlist is empty for now."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-primary">
        {copy.heading || "Wishlist"}
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
