// src/components/shop/BreadCrumb.jsx
import { Link } from "react-router-dom";

export default function BreadCrumb({ items = [] }) {
  return (
    <nav className="text-sm text-secondary/70">
      <ol className="flex items-center gap-2">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {it.to ? (
                <Link to={it.to} className="hover:text-accent">
                  {it.label}
                </Link>
              ) : (
                <span className="text-primary">{it.label}</span>
              )}
              {!last && <span className="text-secondary/50">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
