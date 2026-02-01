// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LayoutSelector from "./components/layout/LayoutSelector";
import HomePage from "./screens/HomePage";
import ShopPage from "./screens/ShopPage";
import SetsPage from "./screens/SetsPage";
import ProductDetailPage from "./screens/ProductDetailPage";
import CartPage from "./screens/CartPage";
import AuthSelector from "./components/auth/AuthSelector";
import AboutPage from "./screens/AboutPage";
import ContactPage from "./screens/ContactPage";
import FAQPage from "./screens/FAQPage";
import SetDetailsPage from "./screens/SetDetailsPage";
import CheckoutPage from "./screens/CheckoutPage";
import SuccesPage from "./screens/SuccessPage";
import RequireAuth from "./components/auth/RequireAuth";
import ShippingReturnsPage from "./screens/ShippingReturnsPage";
import PrivacyPolicyPage from "./screens/PrivacyPolicyPage";
import TermsPage from "./screens/TermsPage";

// Admin
import AdminDashboard from "./screens/admin/AdminDashboard";
import AdminAnalytics from "./screens/admin/AdminAnalytics";
import AdminProducts from "./screens/admin/AdminProducts";
import AdminCategories from "./screens/admin/AdminCategories";
import AdminMedia from "./screens/admin/AdminMedia";
import AdminSets from "./screens/admin/AdminSets";
import AdminCustomers from "./screens/admin/AdminCustomers";
import AdminSettings from "./screens/admin/AdminSettingsPage";
import AdminHeroManager from "./screens/admin/AdminHeroManager";
import AdminOrders from "./screens/admin/AdminOrders";
import AdminDiscounts from "./screens/admin/AdminDiscounts";
import AdminCoupons from "./screens/admin/AdminCoupons";
import AdminCampaignLayout from "./screens/admin/AdminCampaignLayout";
import AdminCampaigns from "./screens/admin/AdminCampaigns";
import AdminReviews from "./screens/admin/AdminReviews";
import AboutSettingsPage from "./screens/admin/AboutSettingsPage.jsx";
import AdminContactSettingsPage from "./screens/admin/AdminContactSettingsPage.jsx";
import AdminFaqSettingsPage from "./screens/admin/AdminFaqSettingsPage.jsx";
import ShippingReturnsSettings from "./screens/admin/ShippingReturnsSettings.jsx";
import PrivacyPolicySettings from "./screens/admin/PrivacyPolicySettings.jsx";
import TermsSettings from "./screens/admin/TermsSettings.jsx";
import ThemeSettingsPage from "./screens/ThemeSettingsPage.jsx";
import AdminStocks from "./screens/admin/AdminStocks.jsx";

// 👇 Global scroll handler
import ScrollToTop from "./components/ScrollToTop.jsx";

// 👇 Tema: DB'deki aktif temayı yükleyip :root'a uygular
import { useThemeInit } from "./utils/theme";

export default function App() {
  // Uygulama açılır açılmaz aktif temayı uygula (storefront + admin)
  useThemeInit();

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 2500 }} />
      <BrowserRouter>
      <ScrollToTop />

      <Routes>
        <Route element={<LayoutSelector />}>
          {/* Public */}
          <Route index element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/sets" element={<SetsPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/account" element={<AuthSelector />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/set/:slug" element={<SetDetailsPage />} />
          <Route path="/shipping-returns" element={<ShippingReturnsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* ✅ Checkout & Success korumalı */}
          <Route
            path="/checkout"
            element={
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout/success"
            element={
              <RequireAuth>
                <SuccesPage />
              </RequireAuth>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={<Navigate to="/admin/dashboard" replace />}
          />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/media" element={<AdminMedia />} />
          <Route path="/admin/sets" element={<AdminSets />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/discounts" element={<AdminDiscounts />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/settings/about" element={<AboutSettingsPage />} />
          <Route path="/admin/settings/terms" element={<TermsSettings />} />
          <Route path="/admin/settings/theme" element={<ThemeSettingsPage />} />
          <Route path="/admin/stocks" element={<AdminStocks />} />
          <Route
            path="/admin/settings/privacy"
            element={<PrivacyPolicySettings />}
          />
          <Route
            path="/admin/settings/shipping-returns"
            element={<ShippingReturnsSettings />}
          />
          <Route
            path="/admin/settings/faq"
            element={<AdminFaqSettingsPage />}
          />
          <Route
            path="/admin/settings/contact"
            element={<AdminContactSettingsPage />}
          />
          <Route
            path="/admin/campaigns/layout"
            element={<AdminCampaignLayout />}
          />
          <Route path="/admin/campaigns" element={<AdminCampaigns />} />
          <Route path="/admin/settings/hero" element={<AdminHeroManager />} />
          <Route path="/admin/settings/reviews" element={<AdminReviews />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </>
  );
}
