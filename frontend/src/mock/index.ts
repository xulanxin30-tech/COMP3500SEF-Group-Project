/**
 * Mock 数据层
 *
 * 后端 API 契约就绪前的本地实现。handler 的签名与真实接口返回结构保持一致，
 * 切换真实后端时只需关闭 VITE_USE_MOCK，无需改动任何业务代码。
 */
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

/* ---------- 确定性伪随机（保证每次构建/刷新数据稳定） ---------- */
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

/* ---------- 基础词表 ---------- */
const CUSTOMERS = [
  '华南电子科技', '云杉供应链', '恒信五金', '蓝鲸跨境电商', '明志医疗器械',
  '骏达汽配', '绿源食品', '星辰光电', '峰瑞建材', '优选日化',
]
const CARGOS = [
  '电子元器件', '服装辅料', '精密仪器', '汽车配件', '冷冻食品',
  '日化用品', '医疗耗材', '建材板材', '锂电池组', '办公设备',
]

const STATUSES: Order['status'][] = [
  'PENDING', 'IN_TRANSIT', 'IN_TRANSIT', 'DELIVERING', 'SIGNED', 'SIGNED', 'SIGNED', 'EXCEPTION',
]

/* ---------- 生成 56 条订单（时间分布在 09-16 ~ 09-30） ---------- */
function buildOrders(): Order[] {
  const orders: Order[] = []
  for (let i = 0; i < 56; i++) {
    const day = int(16, 30)
    const created = new Date(2026, 8, day, int(8, 19), int(0, 59))
    const updated = new Date(created.getTime() + int(2, 72) * 3600_000)
    let origin = pick(CITIES)
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

/* ---------- 库存数据 ---------- */
const WAREHOUSES = ['深圳前海仓', '广州白云仓', '上海浦东仓', '成都双流仓']
const INVENTORY_CATEGORIES = ['电子元器件', '服装辅料', '精密仪器', '汽车配件', '日化用品', '建材板材']

function buildInventory(): InventoryItem[] {
  const items: InventoryItem[] = []
  for (let i = 0; i < 24; i++) {
    const category = INVENTORY_CATEGORIES[i % INVENTORY_CATEGORIES.length]
    const safetyStock = int(50, 200)
    // 约四分之一的条目低于安全库存，便于展示预警
    const quantity = i % 4 === 0 ? int(5, safetyStock - 1) : int(safetyStock, 2000)
    const updated = new Date(2026, 9, int(1, 5), int(8, 20), int(0, 59))
    items.push({
      id: `inv-${i + 1}`,
      sku: `SKU-${String(1000 + i)}`,
      name: `${CARGOS[i % CARGOS.length]}-${String(i + 1).padStart(2, '0')}号`,
      category,
      warehouse: WAREHOUSES[i % WAREHOUSES.length],
      quantity,
      unit: pick(['箱', '件', '托', '卷']),
      safetyStock,
      updatedAt: updated.toISOString(),
    })
  }
  return items
}

const INVENTORY = buildInventory()

/* ---------- 运单数据 ---------- */
const WAYBILLS: Waybill[] = []

function genWaybillNo(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `WB${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${String(Math.floor(Math.random() * 9000) + 1000)}`
}

const USERS: (User & { password: string })[] = [
  { id: 'u-demo', username: 'demo', password: 'demo123', displayName: '演示用户', role: '运营专员' },
  { id: 'u-1', username: 'admin', password: '123456', displayName: '池轩一', role: '前端开发' },
  { id: 'u-2', username: 'dispatcher', password: '123456', displayName: '调度员', role: '调度专员' },
]

/* ---------- Mock 路由表 ---------- */
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
    if (!user) return fail(1001, '用户名或密码错误')
    const { password: _pw, ...safeUser } = user
    const result: LoginResult = {
      token: `mock-token-${user.id}-${Date.now()}`,
      user: safeUser,
    }
    return ok(result, '登录成功')
  },

  'GET /auth/profile': () => {
    const { password: _pw, ...safeUser } = USERS[0]
    return ok(safeUser)
  },

  'GET /orders/stats': () => {
    const today = new Date().toISOString().slice(0, 10)
    const todayCount = ORDERS.filter((o) => o.createdAt.slice(0, 10) === today).length
    const inTransit = ORDERS.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'DELIVERING').length
    const exception = ORDERS.filter((o) => o.status === 'EXCEPTION').length
    const signed = ORDERS.filter((o) => o.status === 'SIGNED').length
    const stats: OrderStats = {
      todayCount: todayCount > 0 ? todayCount : 6,
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
    let list = ORDERS
    if (query.status && query.status !== 'ALL') {
      list = list.filter((o) => o.status === query.status)
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase()
      list = list.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(kw) ||
          o.customer.includes(kw) ||
          o.cargo.includes(kw) ||
          o.driver.includes(kw),
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

  /** 下单 */
  'POST /orders': ({ data }) => {
    const payload = (data ?? {}) as Partial<CreateOrderPayload>
    if (!payload.customer || !payload.origin || !payload.destination || !payload.cargo) {
      return fail(1002, '请完整填写客户、线路与货物信息')
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const orderNo = `YD${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${String(ORDERS.length + 101)}`
    const order: Order = {
      id: `order-${Date.now()}`,
      orderNo,
      customer: payload.customer,
      origin: payload.origin,
      destination: payload.destination,
      cargo: payload.cargo,
      pieces: Number(payload.pieces) || 1,
      weightKg: Number(payload.weightKg) || 0,
      freight: Number(payload.freight) || 0,
      status: 'PENDING',
      driver: payload.driver || '待分配',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    ORDERS.unshift(order)
    return ok(order, '下单成功')
  },

  /** 修改订单状态 */
  'PUT /orders/:id/status': ({ data, params }) => {
    const id = params?.id ? String(params.id) : ''
    const order = ORDERS.find((o) => o.id === id)
    if (!order) return fail(1003, '订单不存在')
    const status = (data as { status?: OrderStatus })?.status
    if (!status) return fail(1004, '缺少目标状态')
    order.status = status
    order.updatedAt = new Date().toISOString()
    return ok(order, '状态已更新')
  },

  /** 库存查询 */
  'GET /inventory': ({ params }) => {
    const keyword = params?.keyword ? String(params.keyword).toLowerCase() : ''
    if (!keyword) return ok(INVENTORY)
    const list = INVENTORY.filter(
      (i) =>
        i.sku.toLowerCase().includes(keyword) ||
        i.name.toLowerCase().includes(keyword) ||
        i.category.includes(keyword) ||
        i.warehouse.includes(keyword),
    )
    return ok(list)
  },

  /** 运单列表 */
  'GET /waybills': () => ok([...WAYBILLS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  /** 填运单（同步扣减库存） */
  'POST /waybills': ({ data }) => {
    const payload = (data ?? {}) as Partial<CreateWaybillPayload>
    if (!payload.sku || !Number(payload.quantity) || !payload.senderName || !payload.receiverName) {
      return fail(1005, '请填写 SKU、数量、发货人与收货人')
    }
    const item = INVENTORY.find((i) => i.sku === payload.sku)
    if (!item) return fail(2001, `SKU ${payload.sku} 不存在`)
    const qty = Number(payload.quantity)
    if (item.quantity < qty) {
      return fail(2003, `库存不足，${item.name} 当前可用 ${item.quantity}${item.unit}`)
    }
    item.quantity -= qty
    const now = new Date()
    const waybill: Waybill = {
      id: `wb-${Date.now()}`,
      waybillNo: genWaybillNo(),
      orderNo: payload.orderNo ?? `YD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}0001`,
      sku: item.sku,
      cargoName: item.name,
      quantity: qty,
      unit: item.unit,
      warehouse: item.warehouse,
      senderName: payload.senderName,
      senderPhone: payload.senderPhone ?? '',
      senderAddress: payload.senderAddress ?? '',
      receiverName: payload.receiverName,
      receiverPhone: payload.receiverPhone ?? '',
      receiverAddress: payload.receiverAddress ?? '',
      status: 'PENDING',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    WAYBILLS.unshift(waybill)
    return ok(waybill, `运单已生成，已扣减 ${qty}${item.unit}`)
  },

  /** 改运单状态 */
  'PUT /waybills/:id/status': ({ data, params }) => {
    const wb = WAYBILLS.find((w) => w.id === String(params?.id ?? ''))
    if (!wb) return fail(1003, '运单不存在')
    const status = (data as { status?: WaybillStatus })?.status
    if (!status) return fail(1004, '缺少目标状态')
    wb.status = status
    wb.updatedAt = new Date().toISOString()
    return ok(wb, '运单状态已更新')
  },
}

/** 按「METHOD path」匹配 Mock 路由，支持 :param 形式的路径参数 */
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
