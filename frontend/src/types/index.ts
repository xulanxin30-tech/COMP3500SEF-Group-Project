/** Frontend contracts for the local demo API and browser mock. */
export type OrderStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'DELIVERING'
  | 'SIGNED'
  | 'EXCEPTION'

export interface Order {
  id: string

  /** Human-readable order reference, e.g. YD202610061001. */
  orderNo: string

  customer: string

  origin: string

  destination: string

  cargo: string

  pieces: number

  weightKg: number

  /** Freight charge in CNY. */
  freight: number
  status: OrderStatus

  driver: string

  /** ISO timestamp. */
  createdAt: string

  /** ISO timestamp of the most recent change. */
  updatedAt: string
}

export interface User {
  id: string
  username: string
  displayName: string
  role: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

export interface OrderQuery {
  page: number
  pageSize: number
  status?: OrderStatus | 'ALL'
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface OrderStats {
  todayCount: number
  inTransit: number
  exception: number
  signedRate: number
}

export interface CreateOrderPayload {
  customer: string
  origin: string
  destination: string
  cargo: string
  pieces: number
  weightKg: number
  freight: number
  driver?: string
}

export interface InventoryItem {
  id: string
  sku: string
  name: string
  category: string

  warehouse: string
  quantity: number
  unit: string

  /** Show a restock alert when quantity falls below this value. */
  safetyStock: number
  updatedAt: string
}

export type WaybillStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'DELIVERING'
  | 'SIGNED'
  | 'EXCEPTION'
  | 'CANCELLED'

export interface Waybill {
  id: string
  waybillNo: string

  orderNo: string

  /** SKU whose stock was deducted when the waybill was created. */
  sku: string
  cargoName: string
  quantity: number
  unit: string
  warehouse: string
  senderName: string
  senderPhone: string
  senderAddress: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  status: WaybillStatus
  createdAt: string
  updatedAt: string
}

export interface CreateWaybillPayload {
  sku: string
  quantity: number
  orderNo?: string
  senderName: string
  senderPhone?: string
  senderAddress?: string
  receiverName: string
  receiverPhone?: string
  receiverAddress?: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
