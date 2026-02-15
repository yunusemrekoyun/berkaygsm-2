// src/components/layout/AdminLayout.jsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  BarChart3,
  Package,
  Tags,
  Layers,
  Image,
  ShoppingCart,
  Users,
  Percent,
  TicketPercent,
  Boxes,
  Wrench,
  // Megaphone,
  // MessageSquare,
  Settings,
  Bell,
  Search,
  Home,
  LogOut,
  Sparkles,
  // SlidersHorizontal,
} from "lucide-react";
import { authApi } from "../../api/auth";
import { getUser as getUserCache } from "../../api/client";

export default function AdminLayout({ children, title, subtitle, actions }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [me, setMe] = useState(getUserCache());
  const [busyCount, setBusyCount] = useState(0);
  const busySetRef = useRef(new Set());
  const bodyOverflow = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await authApi.me();
        if (mounted && res) setMe(res);
      } catch {
        /* layout guard yönlendirecek */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (bodyOverflow.current === null) {
      bodyOverflow.current = document?.body?.style?.overflow || "";
    }
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = bodyOverflow.current || "";
    }
    return () => {
      document.body.style.overflow = bodyOverflow.current || "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      const id = detail.id;
      if (!id) return;
      const set = busySetRef.current;
      if (detail.type === "start") {
        set.add(id);
      } else if (detail.type === "end") {
        set.delete(id);
      }
      setBusyCount(set.size);
    };
    window.addEventListener("admin-action", handler);
    return () => {
      window.removeEventListener("admin-action", handler);
    };
  }, []);

  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (!parts[0]) return [];
    return parts.map((part, index) => ({
      label: pretty(part),
      href: "/" + parts.slice(0, index + 1).join("/"),
    }));
  }, [location.pathname]);

  const menu = useMemo(
    () => [
      {
        label: "Genel Bakış",
        items: [
          {
            to: "/admin/dashboard",
            label: "Kontrol Paneli",
            Icon: LayoutDashboard,
          },
          { to: "/admin/analytics", label: "Analitik", Icon: BarChart3 },
        ],
      },
      {
        label: "Katalog",
        items: [
          { to: "/admin/products", label: "Ürünler", Icon: Package },
          { to: "/admin/categories", label: "Kategoriler", Icon: Tags },
          { to: "/admin/sets", label: "Setler", Icon: Layers },
          { to: "/admin/media", label: "Medya Kütüphanesi", Icon: Image },
          { to: "/admin/discounts", label: "İndirimler", Icon: Percent },
          { to: "/admin/coupons", label: "Kuponlar", Icon: TicketPercent },
           { to: "/admin/stocks", label: "Stok Yönetimi", Icon: Boxes },
           { to: "/admin/service-records", label: "Servis Kayıtları", Icon: Wrench },
        ],
      },
      {
        label: "Ticaret",
        items: [
          { to: "/admin/orders", label: "Siparişler", Icon: ShoppingCart },
          { to: "/admin/customers", label: "Müşteriler", Icon: Users },
        ],
      },
      {
        label: "Sistem",
        items: [{ to: "/admin/settings", label: "Ayarlar", Icon: Settings }],
      },
    ],
    []
  );

  async function handleLogout() {
    await authApi.logout();
    navigate("/account?view=login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-admin)] text-[var(--color-text-admin)]">
      {busyCount > 0 && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--color-text-admin)] shadow-lg">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
            İşlem yapılıyor…
          </div>
        </div>
      )}
      {/* Masaüstü yan menü */}
      <aside
        className={`hidden md:flex md:flex-col border-r border-[var(--color-border-admin)]/30 bg-[var(--color-bg-sidebar)] text-[var(--color-text-sidebar)] transition-[width] duration-300
        ${
          sidebarCollapsed ? "md:w-20" : "md:w-72"
        } md:sticky md:top-0 md:h-screen`}
      >
        <SidebarHeader
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />

        {/* nav kendi içinde scrollable */}
        <nav className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden px-3 py-6 space-y-6">
          {menu.map((section) => (
            <SidebarSection
              key={section.label}
              section={section}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        <SidebarFooter collapsed={sidebarCollapsed} me={me} />
      </aside>

      <MobileDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menu={menu}
        me={me}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumbs={breadcrumbs}
          onMenuToggle={() => setSidebarOpen(true)}
          me={me}
          onLogout={handleLogout}
        />

        <PageHeader
          title={title || pageTitleFromBreadcrumb(breadcrumbs) || "Genel Bakış"}
          subtitle={subtitle}
          actions={actions}
        />

        {/* body scroll'u: tüm sayfa scroll, kolonu iç scroll yapmıyoruz */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-none px-4 pb-8 pt-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- Sidebar ---------------- */

function SidebarHeader({ collapsed, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-admin)]/30 px-4 py-4">
      <Link to="/admin/dashboard" className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">
              Berkay GSM
            </span>
            <span className="text-xs text-white/70">Yönetim Konsolu</span>
          </div>
        )}
      </Link>
      <button
        onClick={onToggle}
        className="hidden md:inline-flex rounded-lg p-2 text-white/80 -translate-x-5"
        aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
      >
        {collapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

function SidebarSection({ section, collapsed, onNavigate }) {
  if (!section?.items?.length) return null;
  return (
    <div>
      {!collapsed && (
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-white/60">
          {section.label}
        </p>
      )}
      <ul className="space-y-1">
        {section.items.map((item) => (
          <li key={item.to}>
            <NavItem {...item} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarFooter({ collapsed, me }) {
  return (
    <div className="border-t border-[var(--color-border-admin)]/30 px-3 py-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-semibold text-white">
          {getInitials(me)}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {me?.firstName
                ? `${me.firstName} ${me.lastName || ""}`.trim()
                : "Yönetici"}
            </div>
            <div className="truncate text-xs text-white/70">
              {me?.email || ""}
            </div>
          </div>
        )}
      </div>
      <Link
        to="/"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/10"
        title="Mağazayı Görüntüle"
      >
        <Home className="h-4 w-4" />
        {!collapsed && <span>Mağazayı Görüntüle</span>}
      </Link>
    </div>
  );
}

/* ---------------- Main content ---------------- */

function TopBar({ breadcrumbs, onMenuToggle, me, onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-admin)]/40 bg-[var(--color-bg-card)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-none items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="flex rounded-lg p-2 text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:hidden"
            aria-label="Menüyü Aç"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Breadcrumbs items={breadcrumbs} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-1.5">
            <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
            <input
              placeholder="Yönetim panelinde ara…"
              className="w-48 border-0 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-admin-muted)]"
            />
          </div>
          <button className="rounded-full p-2 text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)]">
            <Bell className="h-5 w-5" />
          </button>
          <UserMenu me={me} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="border-b border-[var(--color-border-admin)]/40 bg-[var(--color-bg-admin)]/60">
      <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
} /* ---------------- Navigation item ---------------- */

// eslint-disable-next-line no-unused-vars
function NavItem({ to, label, Icon, collapsed, onNavigate }) {
  const location = useLocation();
  const linkRef = useRef(null);

  // Aktif change olduğunda menü öğesini görünür alana getir
  useEffect(() => {
    const isActive =
      location.pathname === to || location.pathname.startsWith(to + "/");
    if (isActive && linkRef.current) {
      try {
        linkRef.current.scrollIntoView({ block: "nearest", inline: "nearest" });
      } catch {
        // ignore
      }
    }
  }, [location.pathname, to]);

  return (
    <NavLink
      ref={linkRef}
      to={to}
      title={label}
      onClick={() => {
        if (onNavigate) onNavigate();
      }}
      className={({ isActive }) =>
        [
          "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
          collapsed ? "justify-center" : "justify-start",
          isActive
            ? "bg-[var(--color-bg-card)] text-[var(--color-text-admin)] shadow-sm ring-1 ring-[var(--color-border-admin)]/40"
            : "text-[var(--color-text-sidebar)]/80 hover:bg-white/10 hover:text-[var(--color-text-sidebar)]",
        ].join(" ")
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

/* ---------------- Mobile drawer ---------------- */

function MobileDrawer({ open, onClose, menu, me, onLogout }) {
  return (
    <div
      className={`md:hidden fixed inset-0 z-50 ${
        open ? "" : "pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute left-0 top-0 h-full w-[86%] max-w-80 transform bg-[var(--color-bg-sidebar)] text-[var(--color-text-sidebar)] shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-3"
            onClick={onClose}
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Yönetim Konsolu</span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            aria-label="Menüyü Kapat"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex h-[calc(100%-4rem)] flex-col justify-between">
          <div className="overflow-y-auto px-3 pb-6 pt-4 space-y-6">
            {menu.map((section) => (
              <SidebarSection
                key={section.label}
                section={section}
                collapsed={false}
                onNavigate={onClose}
              />
            ))}
          </div>

          <div className="border-t border-white/10 px-4 py-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-white">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-semibold">
                {getInitials(me)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {me?.firstName
                    ? `${me.firstName} ${me.lastName || ""}`.trim()
                    : "Yönetici"}
                </div>
                <div className="truncate text-xs text-white/70">
                  {me?.email || ""}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Çıkış Yap</span>
            </button>
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/10"
            >
              <Home className="h-4 w-4" />
              <span>Mağazayı Görüntüle</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- User menu ---------------- */

function UserMenu({ me, onLogout }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (event) => {
      if (!(event.target instanceof Node)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("click", close, { once: true });
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm hover:bg-[var(--color-bg-hover)]"
      >
        <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-bg-admin)] text-xs font-semibold text-[var(--color-text-admin)]">
          {getInitials(me)}
        </div>
        <span className="hidden sm:block text-[var(--color-text-admin)]">
          {me?.firstName || "Yönetici"}
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-xl">
          <div className="px-4 py-3">
            <div className="text-sm font-semibold text-[var(--color-text-admin)]">
              {me?.firstName
                ? `${me.firstName} ${me.lastName || ""}`.trim()
                : "Yönetici"}
            </div>
            <div className="truncate text-xs text-[var(--color-text-admin-muted)]">
              {me?.email || ""}
            </div>
          </div>
          <div className="h-px bg-[var(--color-border-admin)]/60" />
          <MenuLink to="/admin/settings">Profil ve Ayarlar</MenuLink>
          <MenuLink to="/admin/dashboard">Kontrol Paneli</MenuLink>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-[var(--color-bg-hover)]"
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, children }) {
  return (
    <Link
      to={to}
      className="block px-4 py-2.5 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
    >
      {children}
    </Link>
  );
}

/* ---------------- Breadcrumbs ---------------- */

function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="flex items-center gap-1 text-sm text-[var(--color-text-admin-muted)]">
      {items.map((crumb, index) => {
        const last = index === items.length - 1;
        return (
          <span key={crumb.href} className="flex items-center">
            {last ? (
              <span className="font-medium text-[var(--color-text-admin)]">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.href}
                className="hover:text-[var(--color-text-admin)]"
              >
                {crumb.label}
              </Link>
            )}
            {!last && (
              <span className="mx-2 text-[var(--color-text-admin-muted)]">
                /
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/* ---------------- Helpers ---------------- */

function pretty(segment) {
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function pageTitleFromBreadcrumb(items = []) {
  if (!items.length) return "";
  return items[items.length - 1].label;
}

function getInitials(user) {
  if (!user) return "AD";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (!name) return (user.email || "AD").slice(0, 2).toUpperCase();
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
