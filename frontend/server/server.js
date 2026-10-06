/** In-memory API for the local frontend demo; separate from the Python/SQLite API. */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 8080)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

const ORDER_STATUSES = ['PENDING', 'IN_TRANSIT', 'DELIVERING', 'SIGNED', 'EXCEPTION']
const WAYBILL_STATUSES = [...ORDER_STATUSES, 'CANCELLED']
const sessions = new Map()
const SESSION_TTL = 8 * 60 * 60 * 1000
const isText = (value) => typeof value === 'string' && value.trim().length > 0
const optionalText = (value) => value === undefined || typeof value === 'string'
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0
const nonnegativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0

const inventory = [
  { id: 'inv-1', sku: 'SKU-1001', name: 'Electronic components-A01', category: 'Electronic components', warehouse: 'Shenzhen Qianhai Warehouse', quantity: 1200, unit: 'boxes', safetyStock: 200 },
  { id: 'inv-2', sku: 'SKU-1002', name: 'Garment accessories-B02', category: 'Garment accessories', warehouse: 'Guangzhou Baiyun Warehouse', quantity: 860, unit: 'rolls', safetyStock: 150 },
  { id: 'inv-3', sku: 'SKU-1003', name: 'Precision instruments-C03', category: 'Precision instruments', warehouse: 'Shanghai Pudong Warehouse', quantity: 120, unit: 'units', safetyStock: 50 },
  { id: 'inv-4', sku: 'SKU-1004', name: 'Auto parts-D04', category: 'Auto parts', warehouse: 'Chengdu Shuangliu Warehouse', quantity: 45, unit: 'pieces', safetyStock: 60 },
  { id: 'inv-5', sku: 'SKU-1005', name: 'Frozen foods-E05', category: 'Frozen foods', warehouse: 'Shenzhen Qianhai Warehouse', quantity: 640, unit: 'pallets', safetyStock: 100 },
  { id: 'inv-6', sku: 'SKU-1006', name: 'Household products-F06', category: 'Household products', warehouse: 'Guangzhou Baiyun Warehouse', quantity: 980, unit: 'boxes', safetyStock: 180 },
  { id: 'inv-7', sku: 'SKU-1007', name: 'Medical supplies-G07', category: 'Medical supplies', warehouse: 'Shanghai Pudong Warehouse', quantity: 75, unit: 'boxes', safetyStock: 80 },
  { id: 'inv-8', sku: 'SKU-1008', name: 'Building panels-H08', category: 'Building panels', warehouse: 'Chengdu Shuangliu Warehouse', quantity: 540, unit: 'pallets', safetyStock: 120 },
]

const waybills = []
const orders = []
for (const item of inventory) item.updatedAt = new Date().toISOString()

function json(res, data, { code = 0, message = 'ok', status = 200 } = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS })
  res.end(JSON.stringify({ code, message, data }))
}

const fail = (res, code, message, status = 200) => json(res, null, { code, message, status })

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1e6) {
        reject(new HttpError(413, 'Request body is too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (size > 1e6) return
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        const body = JSON.parse(raw)
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('Expected an object')
        }
        resolve(body)
      } catch {
        reject(new HttpError(400, 'Request body must be a JSON object'))
      }
    })
    req.on('error', reject)
  })
}

function requireAuth(req, res) {
  const auth = req.headers.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const expires = sessions.get(token)
  if (!expires || expires <= Date.now()) {
    sessions.delete(token)
    fail(res, 401, 'Sign in required or session expired', 401)
    return null
  }
  return token
}

let seq = 1000
const nextId = (prefix) => `${prefix}-${++seq}`
function genNo(prefix) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${prefix}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${++seq}`
}

const routes = {
  'POST /api/v1/auth/login': async (req, res) => {
    const { username, password } = await readBody(req)
    if (username === 'demo' && password === 'demo123') {
      for (const [token, expires] of sessions) {
        if (expires <= Date.now()) sessions.delete(token)
      }
      const token = randomUUID()
      sessions.set(token, Date.now() + SESSION_TTL)
      return json(res, {
        token,
        user: { id: 'u-demo', username: 'demo', displayName: 'Demo User', role: 'Operations Specialist' },
      }, { message: 'Signed in' })
    }
    return fail(res, 1001, 'Invalid username or password')
  },

  'GET /api/v1/auth/profile': (req, res) =>
    requireAuth(req, res)
      ? json(res, { id: 'u-demo', username: 'demo', displayName: 'Demo User', role: 'Operations Specialist' })
      : undefined,

  'GET /api/v1/inventory': (req, res) =>
    requireAuth(req, res)
      ? json(res, inventory)
      : undefined,

  'GET /api/v1/waybills': (req, res) =>
    requireAuth(req, res)
      ? json(res, [...waybills].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      : undefined,

  'POST /api/v1/waybills': async (req, res) => {
    if (!requireAuth(req, res)) return
    const body = await readBody(req)
    const { sku, quantity, senderName, receiverName } = body
    if (![sku, senderName, receiverName].every(isText) ||
        !['orderNo', 'senderPhone', 'senderAddress', 'receiverPhone', 'receiverAddress'].every((key) => optionalText(body[key]))) {
      return fail(res, 1002, 'Enter SKU, quantity, sender and receiver')
    }
    const item = inventory.find((i) => i.sku === sku)
    if (!item) return fail(res, 2001, `SKU ${sku} not found`)
    const qty = quantity
    if (!positiveInteger(qty)) return fail(res, 2002, 'Quantity must be a positive safe integer')
    if (item.quantity < qty) {
      return fail(res, 2003, `Insufficient stock: ${item.name} available: ${item.quantity} ${item.unit}`)
    }
    item.quantity -= qty
    item.updatedAt = new Date().toISOString()

    const waybill = {
      id: nextId('wb'),
      waybillNo: genNo('WB'),
      orderNo: body.orderNo || genNo('YD'),
      sku,
      cargoName: item.name,
      quantity: qty,
      unit: item.unit,
      warehouse: item.warehouse,
      senderName: senderName.trim(),
      senderPhone: body.senderPhone ?? '',
      senderAddress: body.senderAddress ?? '',
      receiverName: receiverName.trim(),
      receiverPhone: body.receiverPhone ?? '',
      receiverAddress: body.receiverAddress ?? '',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    waybills.unshift(waybill)
    return json(res, waybill, { message: `Waybill created. Stock deducted: ${qty} ${item.unit}` })
  },

  'PUT /api/v1/waybills/:id/status': async (req, res, params) => {
    if (!requireAuth(req, res)) return
    const wb = waybills.find((w) => w.id === params.id)
    if (!wb) return fail(res, 1003, 'Waybill not found')
    const { status } = await readBody(req)
    if (!WAYBILL_STATUSES.includes(status)) return fail(res, 1004, 'Invalid waybill status')
    // Stock changes only when crossing the cancellation boundary.
    if (status === 'CANCELLED' && wb.status !== 'CANCELLED') {
      const item = inventory.find((i) => i.sku === wb.sku)
      if (item) {
        item.quantity += wb.quantity
        item.updatedAt = new Date().toISOString()
      }
    }
    if (wb.status === 'CANCELLED' && status !== 'CANCELLED') {
      const item = inventory.find((i) => i.sku === wb.sku)
      if (!item || item.quantity < wb.quantity) return fail(res, 2003, 'Insufficient stock to reactivate waybill')
      item.quantity -= wb.quantity
      item.updatedAt = new Date().toISOString()
    }

    wb.status = status
    wb.updatedAt = new Date().toISOString()
    return json(res, wb, { message: 'Waybill status updated' })
  },

  'GET /api/v1/orders/stats': (req, res) => {
    if (!requireAuth(req, res)) return
    const signed = orders.filter((o) => o.status === 'SIGNED').length
    return json(res, {
      todayCount: orders.filter((o) => o.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
      inTransit: orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'DELIVERING').length,
      exception: orders.filter((o) => o.status === 'EXCEPTION').length,
      signedRate: orders.length ? Math.round((signed / orders.length) * 1000) / 10 : 0,
    })
  },

  'GET /api/v1/orders': (req, res) => {
    if (!requireAuth(req, res)) return
    const url = new URL(req.url, 'http://localhost')
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const status = url.searchParams.get('status')
    if (!positiveInteger(page) || !positiveInteger(pageSize) || pageSize > 100) {
      return fail(res, 1002, 'Page must be a positive integer; pageSize must be between 1 and 100')
    }
    if (status && status !== 'ALL' && !ORDER_STATUSES.includes(status)) return fail(res, 1004, 'Invalid order status')
    const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase()
    let list = orders
    if (status && status !== 'ALL') list = list.filter((o) => o.status === status)
    if (keyword) list = list.filter((o) => (o.orderNo + o.customer + o.cargo + o.driver).toLowerCase().includes(keyword))
    return json(res, { list: list.slice((page - 1) * pageSize, page * pageSize), total: list.length, page, pageSize })
  },

  'POST /api/v1/orders': async (req, res) => {
    if (!requireAuth(req, res)) return
    const body = await readBody(req)
    if (!['customer', 'origin', 'destination', 'cargo'].every((key) => isText(body[key])) || !optionalText(body.driver)) {
      return fail(res, 1002, 'Complete the customer, route and cargo details')
    }
    const pieces = body.pieces ?? 1
    const weightKg = body.weightKg ?? 0
    const freight = body.freight ?? 0
    if (!positiveInteger(pieces) || !nonnegativeNumber(weightKg) || !nonnegativeNumber(freight)) {
      return fail(res, 1002, 'Pieces must be a positive integer; weight and freight must be finite nonnegative numbers')
    }
    const order = {
      id: nextId('order'),
      orderNo: genNo('YD'),
      customer: body.customer.trim(),
      origin: body.origin.trim(),
      destination: body.destination.trim(),
      cargo: body.cargo.trim(),
      pieces,
      weightKg,
      freight,
      status: 'PENDING',
      driver: body.driver?.trim() || 'Unassigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    orders.unshift(order)
    return json(res, order, { message: 'Order created' })
  },

  'PUT /api/v1/orders/:id/status': async (req, res, params) => {
    if (!requireAuth(req, res)) return
    const order = orders.find((o) => o.id === params.id)
    if (!order) return fail(res, 1003, 'Order not found')
    const { status } = await readBody(req)
    if (!ORDER_STATUSES.includes(status)) return fail(res, 1004, 'Invalid order status')
    order.status = status
    order.updatedAt = new Date().toISOString()
    return json(res, order, { message: 'Status updated' })
  },
}

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    return res.end()
  }
  try {
    const { pathname } = new URL(req.url, 'http://localhost')
    const matched = match(req.method, pathname)
    if (!matched) return fail(res, 404, `Endpoint not found: ${req.method} ${pathname}`, 404)
    await matched.handler(req, res, matched.params)
  } catch (err) {
    if (err instanceof URIError || err instanceof TypeError) {
      return fail(res, 400, 'Invalid request URL', 400)
    }
    const status = err instanceof HttpError ? err.status : 500
    fail(res, status === 500 ? 5000 : status, err instanceof HttpError ? err.message : 'Internal server error', status)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[LMS] Server listening: http://127.0.0.1:${server.address().port}/api/v1  Demo account demo / demo123`)
})
