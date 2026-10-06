/** Browser-only demo data. Mutations follow the local API's stock rules. */
import { CITIES, DRIVERS } from '@/lib/constants'
import type {
  ApiResponse,
  CreateOrderPayload,
  CreateWaybillPayload,
  InventoryItem,
  LoginPayload,
  LoginResult,
  Order,
  OrderQuery,
  OrderStats,
  OrderStatus,
  PageResult,
  User,
  Waybill,
  WaybillStatus,
} from '@/types'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260916)
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min

const CUSTOMERS = [
  'South China Electronics', 'Spruce Supply Chain', 'Hengxin Hardware', 'Blue Whale Commerce', 'Mingzhi Medical Devices',
  'Junda Auto Parts', 'Green Source Foods', 'Starlight Optoelectronics', 'Fengrui Building Materials', 'Choice Household Products',
]
const CARGOS = [
  'Electronic components', 'Garment accessories', 'Precision instruments', 'Auto parts', 'Frozen foods',
  'Household products', 'Medical supplies', 'Building panels', 'Lithium battery packs', 'Office equipment',
]

const STATUSES: Order['status'][] = [
  'PENDING', 'IN_TRANSIT', 'IN_TRANSIT', 'DELIVERING', 'SIGNED', 'SIGNED', 'SIGNED', 'EXCEPTION',
]

function buildOrders(): Order[] {
  const orders: Order[] = []
  for (let i = 0; i < 56; i++) {
    const day = int(16, 30)
    const created = new Date(2026, 8, day, int(8, 19), int(0, 59))
    const updated = new Date(created.getTime() + int(2, 72) * 3600_000)
    const origin = pick(CITIES)
    let destination = pick(CITIES)
    if (destination === origin) destination = pick(CITIES.filter((c) => c !== origin))
    orders.push({
      id: `order-${i + 1}`,
      orderNo: `YD2026${String(created.getMonth() + 1).padStart(2, '0')}${String(day).padStart(2, '0')}${String(100 + i)}`,
      customer: pick(CUSTOMERS),
      origin,
      destination,
      cargo: pick(CARGOS),
      pieces: int(5, 400),
      weightKg: int(80, 12000),
      freight: int(600, 28000),
      status: pick(STATUSES),
      driver: pick(DRIVERS),
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
    })
  }
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const ORDERS = buildOrders()

const WAREHOUSES = ['Shenzhen Qianhai Warehouse', 'Guangzhou Baiyun Warehouse', 'Shanghai Pudong Warehouse', 'Chengdu Shuangliu Warehouse']
const INVENTORY_CATEGORIES = ['Electronic components', 'Garment accessories', 'Precision instruments', 'Auto parts', 'Household products', 'Building panels']

function buildInventory(): InventoryItem[] {
  const items: InventoryItem[] = []
  for (let i = 0; i < 24; i++) {
    const category = INVENTORY_CATEGORIES[i % INVENTORY_CATEGORIES.length]
    const safetyStock = int(50, 200)
    const quantity = i % 4 === 0 ? int(5, safetyStock - 1) : int(safetyStock, 2000)
    const updated = new Date(2026, 9, int(1, 5), int(8, 20), int(0, 59))
    items.push({
      id: `inv-${i + 1}`,
      sku: `SKU-${String(1000 + i)}`,
      name: `${CARGOS[i % CARGOS.length]}-${String(i + 1).padStart(2, '0')}`,
      category,
      warehouse: WAREHOUSES[i % WAREHOUSES.length],
      quantity,
      unit: pick(['boxes', 'pieces', 'pallets', 'rolls']),
      safetyStock,
      updatedAt: updated.toISOString(),
    })
  }
  return items
}

const INVENTORY = buildInventory()

const WAYBILLS: Waybill[] = []
let sequence = 1000
const ORDER_STATUSES = ['PENDING', 'IN_TRANSIT', 'DELIVERING', 'SIGNED', 'EXCEPTION']
const WAYBILL_STATUSES = [...ORDER_STATUSES, 'CANCELLED']
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const isNonnegativeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const optionalText = (value: unknown) => value === undefined || typeof value === 'string'
const safeUser = ({ id, username, displayName, role }: User): User => ({ id, username, displayName, role })

function genWaybillNo(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `WB${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${++sequence}`
}

const USERS: (User & { password: string })[] = [
  { id: 'u-demo', username: 'demo', password: 'demo123', displayName: 'Demo User', role: 'Operations Specialist' },
  { id: 'u-1', username: 'admin', password: '123456', displayName: 'Chi Xuanyi', role: 'Frontend Developer' },
  { id: 'u-2', username: 'dispatcher', password: '123456', displayName: 'Dispatcher', role: 'Dispatch Specialist' },
]

interface MockContext {
  data?: unknown
  params?: Record<string, string | number | undefined>
}
type MockHandler = (ctx: MockContext) => ApiResponse<unknown>

const ok = <T>(data: T, message = 'ok'): ApiResponse<T> => ({ code: 0, message, data })
const fail = (code: number, message: string): ApiResponse<never> => ({ code, message, data: null as never })

const routes: Record<string, MockHandler> = {
  'POST /auth/login': ({ data }) => {
    const { username, password } = (data ?? {}) as LoginPayload
    const user = USERS.find((u) => u.username === username && u.password === password)
    if (!user) return fail(1001, 'Invalid username or password')
    const result: LoginResult = {
      token: `mock-token-${user.id}-${Date.now()}`,
      user: safeUser(user),
    }
    return ok(result, 'Signed in')
  },

  'GET /auth/profile': () => {
    return ok(safeUser(USERS[0]))
  },

  'GET /orders/stats': () => {
    const today = new Date().toISOString().slice(0, 10)
    const todayCount = ORDERS.filter((o) => o.createdAt.slice(0, 10) === today).length
    const inTransit = ORDERS.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'DELIVERING').length
    const exception = ORDERS.filter((o) => o.status === 'EXCEPTION').length
    const signed = ORDERS.filter((o) => o.status === 'SIGNED').length
    const stats: OrderStats = {
      todayCount,
      inTransit,
      exception,
      signedRate: Math.round((signed / ORDERS.length) * 1000) / 10,
    }
    return ok(stats)
  },

  'GET /orders': ({ params }) => {
    const query: OrderQuery = {
      page: Number(params?.page ?? 1),
      pageSize: Number(params?.pageSize ?? 10),
      status: (params?.status as OrderQuery['status']) ?? 'ALL',
      keyword: params?.keyword ? String(params.keyword) : '',
    }
    if (!isPositiveInteger(query.page) || !isPositiveInteger(query.pageSize) || query.pageSize > 100) {
      return fail(1002, 'Page must be a positive integer; pageSize must be between 1 and 100')
    }
    if (query.status && query.status !== 'ALL' && !ORDER_STATUSES.includes(query.status)) return fail(1004, 'Invalid order status')
    let list = ORDERS
    if (query.status && query.status !== 'ALL') {
      list = list.filter((o) => o.status === query.status)
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase()
      list = list.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(kw) ||
          o.customer.toLowerCase().includes(kw) ||
          o.cargo.toLowerCase().includes(kw) ||
          o.driver.toLowerCase().includes(kw),
      )
    }
    const start = (query.page - 1) * query.pageSize
    const result: PageResult<Order> = {
      list: list.slice(start, start + query.pageSize),
      total: list.length,
      page: query.page,
      pageSize: query.pageSize,
    }
    return ok(result)
  },

  'POST /orders': ({ data }) => {
    const payload = (data ?? {}) as Partial<CreateOrderPayload>
    if (!isText(payload.customer) || !isText(payload.origin) || !isText(payload.destination) || !isText(payload.cargo) || !optionalText(payload.driver)) {
      return fail(1002, 'Complete the customer, route and cargo details')
    }
    const pieces = payload.pieces ?? 1
    const weightKg = payload.weightKg ?? 0
    const freight = payload.freight ?? 0
    if (!isPositiveInteger(pieces) || !isNonnegativeNumber(weightKg) || !isNonnegativeNumber(freight)) {
      return fail(1002, 'Pieces must be a positive integer; weight and freight must be finite nonnegative numbers')
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const orderNo = `YD${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${String(ORDERS.length + 101)}`
    const order: Order = {
      id: `order-${++sequence}`,
      orderNo,
      customer: payload.customer.trim(),
      origin: payload.origin.trim(),
      destination: payload.destination.trim(),
      cargo: payload.cargo.trim(),
      pieces,
      weightKg,
      freight,
      status: 'PENDING',
      driver: payload.driver || 'Unassigned',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    ORDERS.unshift(order)
    return ok(order, 'Order created')
  },

  'PUT /orders/:id/status': ({ data, params }) => {
    const id = params?.id ? String(params.id) : ''
    const order = ORDERS.find((o) => o.id === id)
    if (!order) return fail(1003, 'Order not found')
    const status = (data as { status?: OrderStatus })?.status
    if (!status || !ORDER_STATUSES.includes(status)) return fail(1004, 'Invalid order status')
    order.status = status
    order.updatedAt = new Date().toISOString()
    return ok(order, 'Status updated')
  },

  'GET /inventory': ({ params }) => {
    const keyword = params?.keyword ? String(params.keyword).toLowerCase() : ''
    if (!keyword) return ok(INVENTORY)
    const list = INVENTORY.filter(
      (i) =>
        i.sku.toLowerCase().includes(keyword) ||
        i.name.toLowerCase().includes(keyword) ||
        i.category.toLowerCase().includes(keyword) ||
        i.warehouse.toLowerCase().includes(keyword),
    )
    return ok(list)
  },

  'GET /waybills': () => ok([...WAYBILLS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  'POST /waybills': ({ data }) => {
    const payload = (data ?? {}) as Partial<CreateWaybillPayload>
    if (!isText(payload.sku) || !isText(payload.senderName) || !isText(payload.receiverName) ||
        !['orderNo', 'senderPhone', 'senderAddress', 'receiverPhone', 'receiverAddress'].every((key) => optionalText(payload[key as keyof CreateWaybillPayload]))) {
      return fail(1005, 'Enter SKU, quantity, sender and receiver')
    }
    const item = INVENTORY.find((i) => i.sku === payload.sku)
    if (!item) return fail(2001, `SKU ${payload.sku} not found`)
    const qty = payload.quantity
    if (!isPositiveInteger(qty)) return fail(2002, 'Quantity must be a positive safe integer')
    if (item.quantity < qty) {
      return fail(2003, `Insufficient stock: ${item.name} available: ${item.quantity} ${item.unit}`)
    }
    item.quantity -= qty
    item.updatedAt = new Date().toISOString()
    const now = new Date()
    const waybill: Waybill = {
      id: `wb-${++sequence}`,
      waybillNo: genWaybillNo(),
      orderNo: payload.orderNo ?? `YD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}0001`,
      sku: item.sku,
      cargoName: item.name,
      quantity: qty,
      unit: item.unit,
      warehouse: item.warehouse,
      senderName: payload.senderName.trim(),
      senderPhone: payload.senderPhone ?? '',
      senderAddress: payload.senderAddress ?? '',
      receiverName: payload.receiverName.trim(),
      receiverPhone: payload.receiverPhone ?? '',
      receiverAddress: payload.receiverAddress ?? '',
      status: 'PENDING',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    WAYBILLS.unshift(waybill)
    return ok(waybill, `Waybill created. Stock deducted: ${qty} ${item.unit}`)
  },

  'PUT /waybills/:id/status': ({ data, params }) => {
    const wb = WAYBILLS.find((w) => w.id === String(params?.id ?? ''))
    if (!wb) return fail(1003, 'Waybill not found')
    const status = (data as { status?: WaybillStatus })?.status
    if (!status || !WAYBILL_STATUSES.includes(status)) return fail(1004, 'Invalid waybill status')
    const item = INVENTORY.find((i) => i.sku === wb.sku)
    if (status === 'CANCELLED' && wb.status !== 'CANCELLED' && item) {
      item.quantity += wb.quantity
      item.updatedAt = new Date().toISOString()
    }
    if (wb.status === 'CANCELLED' && status !== 'CANCELLED') {
      if (!item || item.quantity < wb.quantity) return fail(2003, 'Insufficient stock to reactivate waybill')
      item.quantity -= wb.quantity
      item.updatedAt = new Date().toISOString()
    }
    wb.status = status
    wb.updatedAt = new Date().toISOString()
    return ok(wb, 'Waybill status updated')
  },
}

export function matchMock(method: string, url: string): MockHandler | undefined {
  const key = `${method.toUpperCase()} ${url}`
  const exact = routes[key]
  if (exact) return exact

  const urlSegs = url.split('/').filter(Boolean)
  for (const [pattern, handler] of Object.entries(routes)) {
    const [patMethod, ...patSegs] = pattern.split(' ')
    if (patMethod !== method.toUpperCase()) continue
    const segs = patSegs.join(' ').split('/').filter(Boolean)
    if (segs.length !== urlSegs.length) continue

    const pathParams: Record<string, string> = {}
    let matched = true
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].startsWith(':')) {
        pathParams[segs[i].slice(1)] = decodeURIComponent(urlSegs[i])
      } else if (segs[i] !== urlSegs[i]) {
        matched = false
        break
      }
    }
    if (matched) {
      return (ctx) => handler({ ...ctx, params: { ...pathParams, ...ctx.params } })
    }
  }
  return undefined
}
