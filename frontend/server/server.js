/**
 * 云链物流 · 本地后端服务（零依赖，仅 Node 原生 http）
 *
 * 统一响应壳：{ code: 0, message, data }，code !== 0 表示业务错误
 * 演示账号：demo / demo123
 *
 * 启动：node server/server.js  （端口可用 PORT 环境变量覆盖，默认 8080）
 */
import http from 'node:http'

const PORT = Number(process.env.PORT ?? 8080)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

/* ---------------- 演示数据 ---------------- */

const DRIVERS = ['陈国辉', '李俊杰', '王志强', '张伟民', '刘建军', '赵晓东', '孙立军', '周文斌']
const CITIES = ['深圳', '广州', '上海', '杭州', '北京', '成都', '武汉', '东莞', '苏州', '南京']
const CUSTOMERS = ['华南电子科技', '云杉供应链', '恒信五金', '蓝鲸跨境电商', '明志医疗器械', '骏达汽配']
const CARGOS = ['电子元器件', '服装辅料', '精密仪器', '汽车配件', '冷冻食品', '日化用品', '建材板材']

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

/** 库存：建运单时会从这里扣减 */
const inventory = [
  { id: 'inv-1', sku: 'SKU-1001', name: '电子元器件-A01', category: '电子元器件', warehouse: '深圳前海仓', quantity: 1200, unit: '箱', safetyStock: 200 },
  { id: 'inv-2', sku: 'SKU-1002', name: '服装辅料-B02', category: '服装辅料', warehouse: '广州白云仓', quantity: 860, unit: '卷', safetyStock: 150 },
  { id: 'inv-3', sku: 'SKU-1003', name: '精密仪器-C03', category: '精密仪器', warehouse: '上海浦东仓', quantity: 120, unit: '台', safetyStock: 50 },
  { id: 'inv-4', sku: 'SKU-1004', name: '汽车配件-D04', category: '汽车配件', warehouse: '成都双流仓', quantity: 45, unit: '件', safetyStock: 60 },
  { id: 'inv-5', sku: 'SKU-1005', name: '冷冻食品-E05', category: '冷冻食品', warehouse: '深圳前海仓', quantity: 640, unit: '托', safetyStock: 100 },
  { id: 'inv-6', sku: 'SKU-1006', name: '日化用品-F06', category: '日化用品', warehouse: '广州白云仓', quantity: 980, unit: '箱', safetyStock: 180 },
  { id: 'inv-7', sku: 'SKU-1007', name: '医疗耗材-G07', category: '医疗耗材', warehouse: '上海浦东仓', quantity: 75, unit: '箱', safetyStock: 80 },
  { id: 'inv-8', sku: 'SKU-1008', name: '建材板材-H08', category: '建材板材', warehouse: '成都双流仓', quantity: 540, unit: '托', safetyStock: 120 },
]

const waybills = []
const orders = []

/* ---------------- 工具函数 ---------------- */

function json(res, data, { code = 0, message = 'ok', status = 200 } = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS })
  res.end(JSON.stringify({ code, message, data }))
}

const fail = (res, code, message, status = 200) => json(res, null, { code, message, status })

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1e6) req.destroy()
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function requireAuth(req, res) {
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Bearer ')) {
    fail(res, 401, '未登录或登录已过期', 401)
    return null
  }
  return auth.slice(7)
}

let seq = 1000
const nextId = (prefix) => `${prefix}-${++seq}`
function genNo(prefix) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${prefix}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${String(int(1000, 9999))}`
}

/* ---------------- 路由 ---------------- */

const routes = {
  'POST /api/v1/auth/login': async (req, res) => {
    const { username, password } = await readBody(req)
    if (username === 'demo' && password === 'demo123') {
      return json(res, {
        token: `demo-token-${Date.now()}`,
        user: { id: 'u-demo', username: 'demo', displayName: '演示用户', role: '运营专员' },
      }, { message: '登录成功' })
    }
    return fail(res, 1001, '用户名或密码错误')
  },

  'GET /api/v1/auth/profile': (req, res) =>
    requireAuth(req, res)
      ? json(res, { id: 'u-demo', username: 'demo', displayName: '演示用户', role: '运营专员' })
      : undefined,

  /** 库存查询 */
  'GET /api/v1/inventory': (req, res) =>
    requireAuth(req, res)
      ? json(res, inventory.map((i) => ({ ...i, updatedAt: new Date().toISOString() })))
      : undefined,

  /** 运单列表 */
  'GET /api/v1/waybills': (req, res) =>
    requireAuth(req, res)
      ? json(res, [...waybills].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      : undefined,

  /** 建运单并扣库存 */
  'POST /api/v1/waybills': async (req, res) => {
    if (!requireAuth(req, res)) return
    const body = await readBody(req)
    const { sku, quantity, senderName, receiverName } = body
    if (!sku || !Number(quantity) || !senderName || !receiverName) {
      return fail(res, 1002, '请填写 SKU、数量、发货人与收货人')
    }
    const item = inventory.find((i) => i.sku === sku)
    if (!item) return fail(res, 2001, `SKU ${sku} 不存在`)
    const qty = Number(quantity)
    if (qty <= 0) return fail(res, 2002, '数量必须大于 0')
    if (item.quantity < qty) {
      return fail(res, 2003, `库存不足，${item.name} 当前可用 ${item.quantity}${item.unit}`)
    }

    // 扣库存
    item.quantity -= qty

    const waybill = {
      id: nextId('wb'),
      waybillNo: genNo('WB'),
      orderNo: body.orderNo || genNo('YD'),
      sku,
      cargoName: item.name,
      quantity: qty,
      unit: item.unit,
      warehouse: item.warehouse,
      senderName,
      senderPhone: body.senderPhone ?? '',
      senderAddress: body.senderAddress ?? '',
      receiverName,
      receiverPhone: body.receiverPhone ?? '',
      receiverAddress: body.receiverAddress ?? '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    waybills.unshift(waybill)
    return json(res, waybill, { message: `运单已生成，已扣减 ${qty}${item.unit}` })
  },

  /** 改运单状态（取消时回补库存） */
  'PUT /api/v1/waybills/:id/status': async (req, res, params) => {
    if (!requireAuth(req, res)) return
    const wb = waybills.find((w) => w.id === params.id)
    if (!wb) return fail(res, 1003, '运单不存在')
    const { status } = await readBody(req)
    const allowed = ['PENDING', 'IN_TRANSIT', 'DELIVERING', 'SIGNED', 'EXCEPTION', 'CANCELLED']
    if (!allowed.includes(status)) return fail(res, 1004, '非法的运单状态')

    // 取消：把建单时扣掉的库存还回去
    if (status === 'CANCELLED' && wb.status !== 'CANCELLED') {
      const item = inventory.find((i) => i.sku === wb.sku)
      if (item) item.quantity += wb.quantity
    }
    // 已取消的运单再次启用：重新扣库存
    if (wb.status === 'CANCELLED' && status !== 'CANCELLED') {
      const item = inventory.find((i) => i.sku === wb.sku)
      if (item) item.quantity -= wb.quantity
    }

    wb.status = status
    wb.updatedAt = new Date().toISOString()
    return json(res, wb, { message: '运单状态已更新' })
  },

  /* 以下为订单页保留接口，保证既有页面仍可演示 */
  'GET /api/v1/orders/stats': (req, res) => {
    if (!requireAuth(req, res)) return
    const signed = orders.filter((o) => o.status === 'SIGNED').length
    return json(res, {
      todayCount: orders.length ? Math.max(6, orders.filter((o) => o.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length) : 6,
      inTransit: orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'DELIVERING').length,
      exception: orders.filter((o) => o.status === 'EXCEPTION').length,
      signedRate: orders.length ? Math.round((signed / orders.length) * 1000) / 10 : 0,
    })
  },

  'GET /api/v1/orders': (req, res) => {
    if (!requireAuth(req, res)) return
    const url = new URL(req.url, `http://${req.headers.host}`)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const status = url.searchParams.get('status')
    const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase()
    let list = orders
    if (status && status !== 'ALL') list = list.filter((o) => o.status === status)
    if (keyword) list = list.filter((o) => (o.orderNo + o.customer + o.cargo + o.driver).toLowerCase().includes(keyword))
    return json(res, { list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize })
  },

  'POST /api/v1/orders': async (req, res) => {
    if (!requireAuth(req, res)) return
    const body = await readBody(req)
    if (!body.customer || !body.cargo) return fail(res, 1002, '请填写客户与货物信息')
    const order = {
      id: nextId('order'),
      orderNo: genNo('YD'),
      customer: body.customer,
      origin: body.origin ?? pick(CITIES),
      destination: body.destination ?? pick(CITIES),
      cargo: body.cargo,
      pieces: Number(body.pieces) || 1,
      weightKg: Number(body.weightKg) || 0,
      freight: Number(body.freight) || 0,
      status: 'PENDING',
      driver: body.driver ?? pick(DRIVERS),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    orders.unshift(order)
    return json(res, order, { message: '下单成功' })
  },

  'PUT /api/v1/orders/:id/status': async (req, res, params) => {
    if (!requireAuth(req, res)) return
    const order = orders.find((o) => o.id === params.id)
    if (!order) return fail(res, 1003, '订单不存在')
    const { status } = await readBody(req)
    order.status = status
    order.updatedAt = new Date().toISOString()
    return json(res, order, { message: '状态已更新' })
  },
}

/* ---------------- 路由匹配（支持 :param） ---------------- */

function match(method, pathname) {
  const key = `${method} ${pathname}`
  if (routes[key]) return { handler: routes[key], params: {} }
  const segs = pathname.split('/').filter(Boolean)
  for (const pattern of Object.keys(routes)) {
    const [m, ...patSegs] = pattern.split(' ')
    if (m !== method) continue
    const pats = patSegs.join(' ').split('/').filter(Boolean)
    if (pats.length !== segs.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < pats.length; i++) {
      if (pats[i].startsWith(':')) params[pats[i].slice(1)] = decodeURIComponent(segs[i])
      else if (pats[i] !== segs[i]) { ok = false; break }
    }
    if (ok) return { handler: routes[pattern], params }
  }
  return null
}

/* ---------------- 启动 ---------------- */

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    return res.end()
  }
  const { pathname } = new URL(req.url, `http://${req.headers.host}`)
  const matched = match(req.method, pathname)
  if (!matched) return fail(res, 404, `接口不存在: ${req.method} ${pathname}`, 404)
  try {
    await matched.handler(req, res, matched.params)
  } catch (err) {
    fail(res, 5000, err?.message ?? '服务内部错误', 500)
  }
})

server.listen(PORT, () => {
  console.log(`[LMS] 后端已启动: http://localhost:${PORT}/api/v1  演示账号 demo / demo123`)
})
