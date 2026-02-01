// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LayoutSelector from "./components/layout/LayoutSelector";
import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import SetsPage from "./pages/SetsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import AuthSelector from "./components/auth/AuthSelector";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FAQPage from "./pages/FAQPage";
import SetDetailsPage from "./pages/SetDetailsPage";
import CheckoutPage from "./pages/CheckoutPage";
import SuccesPage from "./pages/SuccessPage";
import RequireAuth from "./components/auth/RequireAuth";
import ShippingReturnsPage from "./pages/ShippingReturnsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminMedia from "./pages/admin/AdminMedia";
import AdminSets from "./pages/admin/AdminSets";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminSettings from "./pages/admin/AdminSettingsPage";
import AdminHeroManager from "./pages/admin/AdminHeroManager";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminDiscounts from "./pages/admin/AdminDiscounts";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminCampaignLayout from "./pages/admin/AdminCampaignLayout";
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminReviews from "./pages/admin/AdminReviews";
import AboutSettingsPage from "./pages/admin/AboutSettingsPage.jsx";
import AdminContactSettingsPage from "./pages/admin/AdminContactSettingsPage.jsx";
import AdminFaqSettingsPage from "./pages/admin/AdminFaqSettingsPage.jsx";
import ShippingReturnsSettings from "./pages/admin/ShippingReturnsSettings.jsx";
import PrivacyPolicySettings from "./pages/admin/PrivacyPolicySettings.jsx";
import TermsSettings from "./pages/admin/TermsSettings.jsx";
import ThemeSettingsPage from "./pages/ThemeSettingsPage.jsx";
import AdminStocks from "./pages/admin/AdminStocks.jsx";

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
