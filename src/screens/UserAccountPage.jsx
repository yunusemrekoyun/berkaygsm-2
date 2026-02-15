import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { authApi } from "../api/auth";
import { couponApi } from "../api/coupons";
import { userDetailsApi } from "../api/userDetails";
import { getUser, setUser } from "../api/client";
import OverviewSection from "../features/account/components/OverviewSection.jsx";
import OrdersSection from "../features/account/components/OrdersSection.jsx";
import AddressesSection from "../features/account/components/AddressesSection.jsx";
import WishlistSection from "../features/account/components/WishlistSection.jsx";
import CouponsSection from "../features/account/components/CouponsSection.jsx";
import BusyBar from "../features/account/components/BusyBar.jsx";
import {
  ACCOUNT_TABS,
  normalizeTab,
  extractAvatarUrl,
  extractErrorMessage,
} from "../features/account/helpers.js";
import Avatar from "../components/ui/Avatar.jsx";
import { useStaticTranslation } from "../i18n/staticContent.js";

export default function UserAccountPage({ onLogout }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlTab =
    normalizeTab(searchParams.get("tab")) ||
    normalizeTab(location.hash.replace(/^#/, "")) ||
    normalizeTab(location.state?.tab);

  const [active, setActive] = useState(urlTab || ACCOUNT_TABS[0]);
  const [user, setUserState] = useState(getUser());
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [favorites, setFavorites] = useState({ products: [], sets: [] });
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [couponsError, setCouponsError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useStaticTranslation();
  const accountCopy = t("userAccount") || {};
  const sidebarCopy = accountCopy.sidebar || {};
  const tabsCopy = sidebarCopy.tabs || {};
  const logoutLabel = sidebarCopy.logout || "Çıkış yap";

  useEffect(() => {
    const cachedUser = getUser();
    if (cachedUser) setUserState(cachedUser);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextTab =
      normalizeTab(params.get("tab")) ||
      normalizeTab(location.hash.replace(/^#/, "")) ||
      normalizeTab(location.state?.tab);
    if (nextTab) {
      setActive(nextTab);
    }
  }, [location.search, location.hash, location.state]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await authApi.me();
        if (mounted && me) setUserState(me);
        const avatarFromMe = extractAvatarUrl(me);

        const details = await userDetailsApi.getAll();
        if (!mounted) return;

        const avatarUrl =
          details?.avatar?.url ||
          details?.profile?.avatar?.url ||
          details?.profile?.avatarUrl ||
          avatarFromMe ||
          null;

        if (details?.user) {
          setProfile({
            firstName: details.user.firstName,
            lastName: details.user.lastName,
            email: details.user.email,
            phone: details.user.phone,
            avatarUrl,
          });
        } else if (details?.profile) {
          setProfile({ ...details.profile, avatarUrl });
        } else {
          setProfile({ avatarUrl });
        }

        setAddresses(details?.addresses || []);
        const fav = await userDetailsApi.favorites();
        setFavorites(fav);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchCoupons = useCallback(
    async ({ force = false } = {}) => {
      if (couponsLoading && !force) return;
      try {
        setCouponsLoading(true);
        setCouponsError("");
        const list = await couponApi.mine();
        setCoupons(Array.isArray(list) ? list : []);
      } catch (error) {
        setCouponsError(extractErrorMessage(error));
      } finally {
        setCouponsLoading(false);
        setCouponsLoaded(true);
      }
    },
    [couponsLoading]
  );

  useEffect(() => {
    if (active !== "Coupons" || couponsLoaded) return;
    fetchCoupons();
  }, [active, couponsLoaded, fetchCoupons]);

  const avatarSrc = profile?.avatarUrl || extractAvatarUrl(user) || null;

  if (loading) {
    return (
      <section className="store-page bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <aside className="md:col-span-3">
              <div className="glass-surface rounded-2xl border border-border bg-white p-4 space-y-4">
                <div className="glass-surface-soft rounded-xl border border-border bg-contact-bg p-4">
                  <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-surface animate-pulse" />
                  <div className="h-4 w-2/3 bg-surface rounded mx-auto animate-pulse" />
                  <div className="mt-2 h-3 w-1/2 bg-surface rounded mx-auto animate-pulse" />
                </div>
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-9 rounded-lg bg-surface animate-pulse" />
                ))}
                <div className="h-10 rounded-full border border-border" />
              </div>
            </aside>
            <div className="md:col-span-9">
              <div className="glass-surface rounded-2xl border border-border bg-white p-6 h-[520px] animate-pulse" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const sidebarUserName =
    profile?.firstName || user?.firstName
      ? `${profile?.firstName || user?.firstName} ${
          profile?.lastName || user?.lastName || ""
        }`.trim()
      : user?.name || "—";

  const sidebarEmail = profile?.email || user?.email || "—";

  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <aside className="md:col-span-3">
            <div className="glass-surface rounded-2xl border border-border bg-white p-4">
              <div className="glass-surface-soft rounded-xl border border-border bg-contact-bg p-4 text-center">
                <Avatar
                  src={avatarSrc}
                  name={sidebarUserName}
                  alt={sidebarUserName}
                  className="mx-auto mb-2 h-16 w-16 border border-border text-xl"
                />
                <div className="font-semibold text-primary">{sidebarUserName}</div>
                <div className="text-sm text-secondary">{sidebarEmail}</div>
              </div>

              <ul className="mt-4 space-y-2">
                {ACCOUNT_TABS.map((tab) => (
                  <li key={tab}>
                    <button
                      className={[
                        "w-full rounded-lg px-3 py-2 text-left text-sm",
                        active === tab
                          ? "bg-surface-hover text-primary"
                          : "hover:bg-surface-hover text-secondary",
                        busy ? "opacity-60 pointer-events-none" : "",
                      ].join(" ")}
                      onClick={() => setActive(tab)}
                    >
                      {tabsCopy[tab] || tab}
                    </button>
                  </li>
                ))}
              </ul>

              <button
                onClick={onLogout}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-primary hover:bg-surface-hover"
                disabled={busy}
              >
                <LogOut className="h-4 w-4" />
                {logoutLabel}
              </button>
            </div>
          </aside>

          <div className="md:col-span-9">
            <div className="glass-surface relative rounded-2xl border border-border bg-white p-6">
              <BusyBar show={busy} />
              <div className={busy ? "pointer-events-none opacity-60" : ""}>
                {active === "Overview" && (
                  <OverviewSection
                    copy={accountCopy.overview}
                    user={user}
                    profile={profile}
                    avatarSrc={avatarSrc}
                    onSave={async (payload) => {
                      try {
                        setBusy(true);
                        await userDetailsApi.updateProfile({
                          firstName: payload.firstName,
                          lastName: payload.lastName,
                          email: payload.email,
                          phone: payload.phone,
                        });
                        if (payload.avatarFile) {
                          const avatar = await userDetailsApi.uploadAvatar(
                            payload.avatarFile
                          );
                          if (avatar?.url) {
                            setProfile((prev) => ({
                              ...(prev || {}),
                              avatarUrl: avatar.url,
                            }));
                          }
                        }
                        const fresh = await authApi.me();
                        if (fresh) {
                          setUser(fresh);
                          setUserState(fresh);
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                )}

                {active === "Orders" && <OrdersSection copy={accountCopy.orders} />}

                {active === "Addresses" && (
                  <AddressesSection
                    copy={accountCopy.addresses}
                    addresses={addresses}
                    onCreate={async (payload) => {
                      const created = await userDetailsApi.createAddress(payload);
                      setAddresses((prev) => [created, ...prev]);
                    }}
                    onUpdate={async (id, payload) => {
                      const updated = await userDetailsApi.updateAddress(
                        id,
                        payload
                      );
                      setAddresses((prev) =>
                        prev.map((address) =>
                          address.id === id ? updated : address
                        )
                      );
                    }}
                    onDelete={async (id) => {
                      await userDetailsApi.deleteAddress(id);
                      setAddresses((prev) =>
                        prev.filter((address) => address.id !== id)
                      );
                    }}
                  />
                )}

                {active === "Wishlist" && (
                  <WishlistSection
                    copy={accountCopy.wishlist}
                    favorites={favorites}
                    onToggle={async (type, id) => {
                      await userDetailsApi.toggleFavorite({ type, id });
                      const fresh = await userDetailsApi.favorites();
                      setFavorites(fresh);
                    }}
                  />
                )}

                {active === "Coupons" && (
                  <CouponsSection
                    copy={accountCopy.coupons}
                    coupons={coupons}
                    loading={couponsLoading}
                    error={couponsError}
                    onRetry={() => fetchCoupons({ force: true })}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
