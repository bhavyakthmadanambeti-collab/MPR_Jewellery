import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '@/context/ToastContext';
import { AuthProvider } from '@/context/AuthContext';
import { SiteProvider } from '@/context/SiteContext';
import { CartProvider } from '@/context/CartContext';
import { CustomerLayout } from '@/layouts/CustomerLayout';
import { PageLoader } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Home from '@/pages/Home';
import Shop from '@/pages/Shop';
import ProductPage from '@/pages/ProductPage';
import Collections, { CollectionDetail } from '@/pages/Collections';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import OrderStatus, { TrackOrder } from '@/pages/OrderStatus';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import NotFound from '@/pages/NotFound';
import Account, { CustomerAuth } from '@/pages/account/Account';

// Owner portal is code-split so customers never download it.
const OwnerLayout = lazy(() => import('@/layouts/OwnerLayout').then((m) => ({ default: m.OwnerLayout })));
const OwnerLogin = lazy(() => import('@/pages/owner/OwnerLogin'));
const Dashboard = lazy(() => import('@/pages/owner/Dashboard'));
const Products = lazy(() => import('@/pages/owner/Products'));
const ProductForm = lazy(() => import('@/pages/owner/ProductForm'));
const Orders = lazy(() => import('@/pages/owner/Orders'));
const OwnerCollections = lazy(() => import('@/pages/owner/OwnerCollections'));
const CollectionEditor = lazy(() => import('@/pages/owner/OwnerCollections').then((m) => ({ default: m.CollectionEditor })));
const Rates = lazy(() => import('@/pages/owner/Rates'));
const Messages = lazy(() => import('@/pages/owner/Messages'));
const Settings = lazy(() => import('@/pages/owner/Settings'));

const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SiteProvider>
          <CartProvider>
            <Router>
              <ScrollTop />
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route element={<CustomerLayout />}>
                    <Route index element={<Home />} />
                    <Route path="jewellery" element={<Shop />} />
                    <Route path="gold" element={<Shop key="gold" metal="gold" />} />
                    <Route path="silver" element={<Shop key="silver" metal="silver" />} />
                    <Route path="products/:slug" element={<ProductPage />} />
                    <Route path="collections" element={<Collections />} />
                    <Route path="collections/:slug" element={<CollectionDetail />} />
                    <Route path="cart" element={<Cart />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="order/:orderNumber" element={<OrderStatus />} />
                    <Route path="track-order" element={<TrackOrder />} />
                    <Route path="about" element={<About />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="account" element={<Account />} />
                    <Route path="account/login" element={<CustomerAuth />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="owner/login" element={<OwnerLogin />} />
                  <Route path="owner" element={<OwnerLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="products" element={<Products />} />
                    <Route path="products/add" element={<ProductForm key="add" />} />
                    <Route path="products/edit/:id" element={<ProductForm key="edit" />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="collections" element={<OwnerCollections />} />
                    <Route path="collections/:id" element={<CollectionEditor />} />
                    <Route path="rates" element={<Rates />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Route>
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </Router>
          </CartProvider>
        </SiteProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
