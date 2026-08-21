import type { Paginated } from './pagination'

export interface User {
  id: number
  name: string
  email: string
  phone?: string
  role: string
  photo?: string | null
  specialty?: string | null
  bio?: string | null
  points_balance?: number
  created_at?: string
}

export interface Motorcycle {
  id: number
  nickname?: string
  plate?: string
  year?: number
  color?: string
  vin?: string
  current_odometer: number
  status: string
  notes?: string
  accessories?: string[]
  documentation?: string
  registered_at?: string
  photo?: string
  brand?: { id: number; name: string } | null
  model?: { id: number; name: string } | null
}

export interface Brand {
  id: number
  name: string
}

export interface MotorcycleModel {
  id: number
  name: string
}

export interface Category {
  id: number
  name: string
  slug: string
  icon?: string | null
  products_count: number
}

export interface Product {
  id: number
  name: string
  slug: string
  description?: string
  price: number
  promo_price?: number | null
  final_price?: number
  part_type?: string
  unit: string
  image?: string
  variants?: { name: string; hex: string }[]
  category?: string
  brand?: string
  available: number
  stock_alert?: boolean
  price_alert?: number | null
}

export interface PriceHistoryPoint {
  price: number
  promo_price?: number | null
  final_price: number
  date: string
}

export interface CompareResponse {
  current: Product
  data: Product[]
  history?: PriceHistoryPoint[]
}

export interface SharedFavorites {
  owner: string
  date: string
  data: Product[]
}

export interface RecommendedCatalog {
  compatible: Product[]
  lubricants: Product[]
  accessories: Product[]
  promotions: Product[]
  alternatives: Product[]
  suggestions: Product[]
}

export interface Appointment {
  id: number
  name: string
  email: string
  phone?: string
  service_type?: string
  notes?: string
  date: string
  time: string
  status: string
}

export interface OrderItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface OrderLabor {
  description: string
  hours: number
  amount: number
}

export interface OrderTimeline {
  status: string
  comment?: string
  created_at?: string
  changed_by?: string
}

export interface WorkOrderSummary {
  id: number
  order_number: string
  status: string
  quotation_status: string
  service_type?: string
  diagnosis?: string
  observations?: string
  created_at?: string
  estimated_delivery?: string
  motorcycle?: {
    id: number
    nickname?: string
    plate?: string
    brand?: string
  } | null
}

export interface WorkOrderDetail extends WorkOrderSummary {
  quotation_total: number
  items: OrderItem[]
  labors: OrderLabor[]
  timeline: OrderTimeline[]
  customer_response_notes?: string
  odometer_in?: number
  mechanic?: { id: number; name: string } | null
}

export interface StaffOrder {
  id: number
  order_number: string
  status: string
  quotation_status: string
  service_type?: string
  diagnosis?: string
  created_at?: string
  estimated_delivery?: string
  quotation_total?: number
  customer?: { id: number; name: string } | null
  motorcycle?: {
    id: number
    nickname?: string
    plate?: string
    brand?: string
  } | null
  mechanic?: { id: number; name: string } | null
}

export interface DashboardStats {
  orders_total: number
  orders_pending: number
  orders_in_progress: number
  orders_awaiting_approval: number
  customers: number
  motorcycles: number
  products: number
  appointments_pending: number
  stock_low: number
  invoices_this_month: number
  profit_this_month: number
  store_orders_pending?: number
  store_proofs_pending?: number
  store_sales_this_month?: number
  recent_store_orders?: StoreOrderRow[]
  monthly_series?: { labels: string[]; sales: number[] }
  channel_series?: { labels: string[]; store: number[]; workshop: number[] }
  top_products?: { product_id: number; name: string; qty: number; revenue: number; stock: number }[]
  payment_distribution?: { label: string; value: number; amount: number; color: string }[]
  orders_by_status?: { label: string; value: number; color: string }[]
  mechanics_workload?: { label: string; active: number; done: number }[]
  recent_orders: StaffOrder[]
}

export interface StoreOrderRow {
  id: number
  invoice_number: string
  order_status: string
  customer?: string | null
  total: number
  payment_method?: string | null
  issued_at?: string
}

export interface StaffUser {
  id: number
  name: string
  email: string
  phone?: string
  role: string
  photo?: string | null
  specialty?: string | null
  bio?: string | null
}

export interface InventoryItem {
  id: number
  name: string
  description?: string | null
  category_id?: number | null
  category?: string | null
  brand_id?: number | null
  brand?: string | null
  sku?: string | null
  unit?: string | null
  image?: string | null
  price: number
  promo_price?: number | null
  cost: number
  quantity: number
  reserved: number
  available: number
  min_stock: number
  is_active?: boolean
}

export interface AppointmentRow {
  id: number
  name: string
  email: string
  phone?: string
  service_type?: string
  motorcycle?: string | null
  date: string
  day_name?: string
  time: string
  status: string
  mechanic_id?: number | null
  mechanic_name?: string | null
}

export interface InvoiceItemInfo {
  product_id?: number | null
  description: string
  variant?: string | null
  quantity: number
  unit_price: number
  total: number
  image?: string | null
}

export interface InvoiceSummary {
  id: number
  invoice_number: string
  source?: 'store' | 'service'
  subtotal: number
  tax: number
  discount: number
  points_used: number
  total: number
  paid_amount?: number
  outstanding?: number
  payment_method: string
  status: string
  order_status?: 'pending' | 'payment_review' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  payment_proof_url?: string | null
  invoice_pdf_url?: string | null
  issue_date?: string
  items?: InvoiceItemInfo[]
  items_count?: number
  thumbnail?: string | null
  warranties?: { id: number; description: string; type: string; duration: number; start_date?: string; end_date?: string; status: string }[]
}

export interface InvoiceTotals {
  orders: number
  total_spent: number
  this_month: number
  outstanding: number
}

export interface TimelineEvent {
  type: 'invoice' | 'order' | 'points' | 'appointment' | 'favorite' | 'rating' | 'motorcycle'
  source: 'store' | 'service' | 'points'
  event_id: string
  id: number
  date?: string
  reference?: string
  title: string
  subtitle?: string
  status: string
  status_label?: string
  amount?: number | null
  paid_amount?: number | null
  outstanding?: number | null
  points?: number | null
  thumbnail?: string | null
  items?: InvoiceItemInfo[]
  items_count?: number
  detail?: {
    payment_method?: string
    quotation_status?: string
    estimated_delivery?: string
    motorcycle?: { nickname?: string; plate?: string; brand?: string } | null
    balance_after?: number
    scheduled_at?: string
    notes?: string
    score?: number
    comment?: string
    year?: number
    color?: string
  }
}

export interface TimelinePage extends Paginated<TimelineEvent> {
  totals: InvoiceTotals
  points_balance: number
}

export interface InvoiceDetail extends InvoiceSummary {
  items: InvoiceItemInfo[]
  warranties?: { id: number; description: string; type: string; duration: number; start_date?: string; end_date?: string; status: string }[]
}

export interface Warranty {
  id: number
  description: string
  type: string
  duration: number
  start_date?: string
  end_date?: string
  status: string
}

export interface LoyaltyInfo {
  balance: number
  history: {
    id: number
    points: number
    concept: string
    balance_after: number
    created_at: string
  }[]
}

export interface AppNotification {
  id: number
  type: string
  title: string
  message: string
  channel: string
  wa_sent: boolean
  read: boolean
  created_at?: string
}

export interface ClientDashboard {
  monthly_series?: { labels: string[]; spend: number[]; orders: number[] }
  services_by_status?: { label: string; value: number; color: string }[]
  motorcycles_count: number
  active_services: number
  active_warranties: number
  warranties: { id: number; description: string; type: string; end_date?: string }[]
  unread_notifications: number
  points_balance: number
  recent_orders: {
    id: number
    order_number: string
    status: string
    quotation_status: string
    created_at?: string
    motorcycle?: { nickname?: string; brand?: string } | null
  }[]
  recent_invoices: {
    id: number
    invoice_number: string
    total: number
    status: string
    issue_date?: string
  }[]
  points_history: { id: number; points: number; concept: string }[]
  next_maintenances: {
    service_name: string
    category?: string
    interval_km?: number
    interval_months?: number
    due_km?: number
    due_date?: string
    km_left?: number
    days_left?: number
    urgency: 'ok' | 'soon' | 'overdue'
    overdue: boolean
    priority_score: number
  }[]
}

export interface MotorcycleHistory {
  motorcycle: Motorcycle
  odometer: number
  maintenances: {
    service_name: string
    category?: string
    interval_km?: number
    interval_months?: number
    due_km?: number
    due_date?: string
    km_left?: number
    days_left?: number
    urgency: 'ok' | 'soon' | 'overdue'
    overdue: boolean
    priority_score: number
  }[]
  services: {
    id: number
    order_number: string
    status: string
    service_type?: string
    diagnosis?: string
    odometer_in?: number
    odometer_out?: number
    created_at?: string
    estimated_delivery?: string
    total: number
    mechanic?: string
    items: {
      description: string
      quantity: number
      unit_price: number
      total: number
    }[]
    labors: {
      description: string
      hours: number
      amount: number
    }[]
    photos: {
      id: number
      caption?: string
      type?: string
      url: string
    }[]
  }[]
  warranties: { id: number; description: string; type: string; duration: number; start_date?: string; end_date?: string; status: string }[]
  invoices: { id: number; invoice_number: string; total: number; issue_date?: string }[]
}

export interface AuthResponse {
  user: User
  token: string
}