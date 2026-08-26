import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { StaffAuthProvider, useStaffAuth } from './auth/StaffAuthContext'
import { CartProvider } from './lib/cart'
import PublicLayout from './layouts/PublicLayout'
import UserLayout from './layouts/UserLayout'
import StaffLayout from './layouts/StaffLayout'
import OfflineAlert from './components/OfflineAlert'
import CookieConsent from './components/CookieConsent'
import { isStaffRole } from './lib/roles'

const Home = lazy(() => import('./pages/public/Home'))
const Services = lazy(() => import('./pages/public/Services'))
const About = lazy(() => import('./pages/public/About'))
const Contact = lazy(() => import('./pages/public/Contact'))
const Store = lazy(() => import('./pages/public/Store'))
const ProductDetail = lazy(() => import('./pages/public/ProductDetail'))
const BookAppointment = lazy(() => import('./pages/public/BookAppointment'))
const TrackOrder = lazy(() => import('./pages/public/TrackOrder'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const Garaje = lazy(() => import('./pages/Garaje'))
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'))
const MotorcycleHistory = lazy(() => import('./pages/MotorcycleHistory'))
const MyServices = lazy(() => import('./pages/MyServices'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const MyFinances = lazy(() => import('./pages/MyFinances'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Chat = lazy(() => import('./pages/Chat'))
const MyOrders = lazy(() => import('./pages/MyOrders'))
const PurchaseHistory = lazy(() => import('./pages/PurchaseHistory'))
const Favorites = lazy(() => import('./pages/Favorites'))
const PortalSettings = lazy(() => import('./pages/PortalSettings'))
const Cart = lazy(() => import('./pages/Cart'))
const BlogPage = lazy(() => import('./pages/public/BlogPage'))
const SharedList = lazy(() => import('./pages/public/SharedList'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const NotFound = lazy(() => import('./pages/public/NotFound'))
const Dashboard = lazy(() => import('./pages/staff/Dashboard'))
const Orders = lazy(() => import('./pages/staff/Orders'))
const Inventory = lazy(() => import('./pages/staff/Inventory'))
const Clients = lazy(() => import('./pages/staff/Clients'))
const Appointments = lazy(() => import('./pages/staff/Appointments'))
const Agenda = lazy(() => import('./pages/staff/Agenda'))
const Team = lazy(() => import('./pages/staff/Team'))
const Sales = lazy(() => import('./pages/staff/Sales'))
const Cash = lazy(() => import('./pages/staff/Cash'))
const Purchases = lazy(() => import('./pages/staff/Purchases'))
const Reports = lazy(() => import('./pages/staff/Reports'))
const Config = lazy(() => import('./pages/staff/Config'))
const Account = lazy(() => import('./pages/staff/Account'))
const Categories = lazy(() => import('./pages/staff/Categories'))
const BrandsModels = lazy(() => import('./pages/staff/BrandsModels'))
const StaffServices = lazy(() => import('./pages/staff/Services'))
const CatalogHub = lazy(() => import('./pages/staff/CatalogHub'))
const StaffNotifications = lazy(() => import('./pages/staff/Notifications'))
const Warranties = lazy(() => import('./pages/staff/Warranties'))
const AuditLog = lazy(() => import('./pages/staff/AuditLog'))

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="flex items-center gap-3 text-carbon-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        Cargando…
      </div>
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-carbon-500">Cargando...</div>
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-carbon-500">Cargando...</div>
  if (user && !isStaffRole(user.role)) return <Navigate to="/panel" replace />
  return <>{children}</>
}

function StaffProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useStaffAuth()
  if (loading) return <div className="p-8 text-carbon-500">Cargando...</div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isStaffRole(user.role)) return <Navigate to="/panel" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StaffAuthProvider>
          <CartProvider>
            <OfflineAlert />
            <CookieConsent />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route
                  element={
                    <RequireGuest>
                      <PublicLayout />
                    </RequireGuest>
                  }
                >
                  <Route path="/" element={<Home />} />
                  <Route path="/servicios" element={<Services />} />
                  <Route path="/nosotros" element={<About />} />
                  <Route path="/contacto" element={<Contact />} />
                  <Route path="/tienda" element={<Store />} />
                  <Route path="/producto/:slug" element={<ProductDetail />} />
                  <Route path="/agendar" element={<BookAppointment />} />
                  <Route path="/consultar" element={<TrackOrder />} />
                  <Route path="/carrito" element={<Cart />} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:slug" element={<BlogPage />} />
                  <Route path="/lista/:token" element={<SharedList />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/registro" element={<Register />} />
                  <Route path="/privacidad" element={<LegalPage title="Política de privacidad" />} />
                  <Route path="/terminos" element={<LegalPage title="Términos y condiciones" />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route
                  element={
                    <Protected>
                      <UserLayout />
                    </Protected>
                  }
                >
                  <Route path="/panel" element={<ClientDashboard />} />
                  <Route path="/panel/garaje" element={<Garaje />} />
                  <Route path="/panel/garaje/:id" element={<MotorcycleHistory />} />
                  <Route path="/panel/servicios" element={<MyServices />} />
                  <Route path="/panel/servicios/:id" element={<OrderDetail />} />
                  <Route path="/panel/pedidos" element={<MyOrders />} />
                  <Route path="/panel/historial" element={<PurchaseHistory />} />
                  <Route path="/panel/favoritos" element={<Favorites />} />
                  <Route path="/panel/configuracion" element={<PortalSettings />} />
                  <Route path="/panel/tienda" element={<Store />} />
                  <Route path="/panel/producto/:slug" element={<ProductDetail />} />
                  <Route path="/panel/carrito" element={<Cart storePath="/panel/tienda" />} />
                  <Route path="/panel/mi-cuenta" element={<MyFinances />} />
                  <Route path="/panel/notificaciones" element={<Notifications />} />
                  <Route path="/panel/chat" element={<Chat />} />
                </Route>
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin"
                  element={
                    <StaffProtected>
                      <StaffLayout />
                    </StaffProtected>
                  }
                >
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="agenda" element={<Agenda />} />
                  <Route path="ordenes" element={<Orders />} />
                  <Route path="inventario" element={<Inventory />} />
                  <Route path="catalogo" element={<CatalogHub />} />
                  <Route path="categorias" element={<Categories />} />
                  <Route path="marcas" element={<BrandsModels />} />
                  <Route path="servicios" element={<StaffServices />} />
                  <Route path="clientes" element={<Clients />} />
                  <Route path="citas" element={<Appointments />} />
                  <Route path="equipo" element={<Team />} />
                  <Route path="ventas" element={<Sales />} />
                  <Route path="reportes" element={<Reports />} />
                  <Route path="caja" element={<Cash />} />
                  <Route path="compras" element={<Purchases />} />
                  <Route path="garantias" element={<Warranties />} />
                  <Route path="auditoria" element={<AuditLog />} />
                  <Route path="configuracion" element={<Config />} />
                  <Route path="notificaciones" element={<StaffNotifications />} />
                  <Route path="cuenta" element={<Account />} />
                </Route>
              </Routes>
            </Suspense>
          </CartProvider>
        </StaffAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
