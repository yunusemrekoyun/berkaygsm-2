// src/components/categories/CategoryItem.jsx
import { Link } from "react-router-dom";
import AppImage from "../ui/AppImage.jsx";

const placeholderImage = "/cat-1.jpg";

export default function CategoryItem({ title, image, to = "#" }) {
  return (
    <Link to={to} className="group block">
      <div className="glass-surface overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <AppImage
          src={image || placeholderImage}
          alt={title}
          width={1400}
          height={1000}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="h-60 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:h-64 md:h-72"
          draggable="false"
        />
      </div>
      <div className="mt-5 text-center">
        <h3 className="text-xl font-semibold tracking-tight text-primary">
          {title}
        </h3>
      </div>
    </Link>
  );
}
