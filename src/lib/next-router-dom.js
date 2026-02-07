"use client";

import LinkNext from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/navigation";
import { forwardRef, useCallback, useEffect, useMemo } from "react";

export const Link = forwardRef(function Link(
  { to, href, replace, prefetch, scroll, ...props },
  ref
) {
  const resolved = href || to || "";
  return (
    <LinkNext
      ref={ref}
      href={resolved}
      replace={replace}
      prefetch={prefetch}
      scroll={scroll}
      {...props}
    />
  );
});

export const NavLink = forwardRef(function NavLink(
  { to, className, ...props },
  ref
) {
  const pathname = usePathname() || "";
  const isActive = pathname === to || (to && pathname.startsWith(to + "/"));
  const resolvedClass =
    typeof className === "function" ? className({ isActive }) : className;

  return <Link ref={ref} to={to} className={resolvedClass} {...props} />;
});

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to, options = {}) => {
      const href = typeof to === "string" ? to : String(to);
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [router]
  );
}

export function useLocation() {
  const pathname = usePathname() || "";
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString()
    ? `?${searchParams.toString()}`
    : "";
  return { pathname, search, hash: "" };
}

export function useSearchParams() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const raw = useNextSearchParams();
  const params = useMemo(
    () => new URLSearchParams(raw ? raw.toString() : ""),
    [raw]
  );

  const setSearchParams = (next, options = {}) => {
    let resolved = "";

    if (next instanceof URLSearchParams) {
      resolved = next.toString();
    } else if (typeof next === "string") {
      resolved = next.startsWith("?") ? next.slice(1) : next;
    } else if (next && typeof next === "object") {
      const sp = new URLSearchParams();
      Object.entries(next).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        sp.set(key, String(value));
      });
      resolved = sp.toString();
    }

    const href = resolved ? `${pathname}?${resolved}` : pathname;
    if (options?.replace) router.replace(href);
    else router.push(href);
  };

  return [params, setSearchParams];
}

export function useParams() {
  return useNextParams() || {};
}

export function Navigate({ to, replace }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}

export function Outlet({ children }) {
  return children ?? null;
}

export function BrowserRouter({ children }) {
  return children ?? null;
}

export function Routes({ children }) {
  return children ?? null;
}

export function Route() {
  return null;
}
