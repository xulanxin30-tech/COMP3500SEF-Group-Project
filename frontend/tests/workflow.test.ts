import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { after, before, describe, it } from 'node:test'
import { matchMock } from '../src/mock/index'
import type { ApiResponse, InventoryItem, LoginResult, Order, OrderStats, PageResult, Waybill } from '../src/types/index'

type Call = <T>(method: string, path: string, data?: unknown, params?: Record<string, string | number>) => Promise<ApiResponse<T>>
let child: ChildProcess
let baseUrl: string
let token: string

const httpCall: Call = async (method, path, data, params) => {
  const query = new URLSearchParams(Object.entries(params ?? {}).map(([key, value]) => [key, String(value)]))
  const res = await fetch(`${baseUrl}${path}?${query}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  return res.json()
}
const mockCall: Call = async <T>(method: string, path: string, data?: unknown, params?: Record<string, string | number>) => {
  const handler = matchMock(method, path)
  assert.ok(handler, `${method} ${path} must exist`)
  return structuredClone(handler({ data, params })) as ApiResponse<T>
}

// Exercise the same workflow contract against both implementations.
for (const [name, call] of [['HTTP API', httpCall], ['browser mock', mockCall]] as const) {
  describe(name, () => {
    if (name === 'HTTP API') {
      before(async () => {
        child = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
        baseUrl = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000)
          const lines = createInterface({ input: child.stdout! })
          child.once('error', reject)
          child.once('exit', (code) => reject(new Error(`Server exited during startup: ${code}`)))
          lines.on('line', (line) => {
            const url = line.match(/http:\/\/127\.0\.0\.1:\d+\/api\/v1/)
            if (url) { clearTimeout(timer); lines.close(); resolve(url[0]) }
          })
        })
        const login = await httpCall<LoginResult>('POST', '/auth/login', { username: 'demo', password: 'demo123' })
        assert.equal(login.code, 0)
        token = login.data.token
      })
      after(async () => {
        if (child && child.exitCode === null) {
          const exited = once(child, 'exit')
          child.kill()
          await exited
        }
      })
    }

    const stock = async () => (await call<InventoryItem[]>('GET', '/inventory')).data
    const create = (sku: string, quantity: unknown) => call<Waybill>('POST', '/waybills', { sku, quantity, senderName: 'Alice', receiverName: 'Bob' })
    const update = (id: string, status: unknown) => call<Waybill>('PUT', `/waybills/${id}/status`, { status })

    it('rejects invalid credentials and does not expose passwords', async () => {
      assert.notEqual((await call('POST', '/auth/login', { username: 'demo', password: 'wrong' })).code, 0)
      const result = await call<LoginResult>('POST', '/auth/login', { username: 'demo', password: 'demo123' })
      assert.equal(result.code, 0)
      assert.equal('password' in result.data.user, false)
    })

    it('rejects invalid quantities without changing stock', async () => {
      const item = (await stock())[0]
      for (const quantity of [-1, 0, 1.5, '2', 'Infinity', Number.MAX_SAFE_INTEGER + 1, null]) {
        assert.equal((await create(item.sku, quantity)).code, 2002)
      }
      assert.equal((await create(item.sku, item.quantity + 1)).code, 2003)
      assert.equal((await stock())[0].quantity, item.quantity)
      assert.notEqual((await call('POST', '/waybills', { sku: item.sku, quantity: 1, senderName: ' ', receiverName: 'Bob' })).code, 0)
    })

    it('deducts stock, cancels once, and refuses reactivation when stock is exhausted', async () => {
      const item = (await stock())[1]
      const created = await create(item.sku, item.quantity)
      assert.equal(created.code, 0)
      const id = created.data.id
      assert.equal((await stock())[1].quantity, 0)
      assert.equal((await update(id, 'CANCELLED')).code, 0)
      assert.equal((await update(id, 'CANCELLED')).code, 0)
      assert.equal((await stock())[1].quantity, item.quantity)
      assert.equal((await update(id, 'IN_TRANSIT')).code, 0)
      assert.equal((await stock())[1].quantity, 0)
      assert.equal((await update(id, 'CANCELLED')).code, 0)
      assert.equal((await create(item.sku, item.quantity)).code, 0)
      assert.equal((await update(id, 'PENDING')).code, 2003)
      assert.equal((await stock())[1].quantity, 0)
      const bills = (await call<Waybill[]>('GET', '/waybills')).data
      assert.equal(bills.find((bill) => bill.id === id)?.status, 'CANCELLED')
      assert.equal((await update(id, 'INVALID')).code, 1004)
    })

    it('creates unique waybills under concurrent requests without overselling', async () => {
      const item = (await stock())[2]
      const results = await Promise.all(Array.from({ length: 12 }, () => create(item.sku, 1)))
      assert.ok(results.every((result) => result.code === 0))
      assert.equal(new Set(results.map((result) => result.data.id)).size, 12)
      assert.equal(new Set(results.map((result) => result.data.waybillNo)).size, 12)
      assert.equal((await stock())[2].quantity, item.quantity - 12)
      const remaining = item.quantity - 12
      const last = await Promise.all([create(item.sku, remaining), create(item.sku, remaining)])
      assert.equal(last.filter((result) => result.code === 0).length, 1)
      assert.equal(last.filter((result) => result.code === 2003).length, 1)
      assert.equal((await stock())[2].quantity, 0)
    })

    it('validates orders and states, and reports actual order statistics', async () => {
      const payload = { customer: 'English Customer', origin: 'Shenzhen', destination: 'Guangzhou', cargo: 'Components', pieces: 2, weightKg: 0.5, freight: 10 }
      for (const change of [{ pieces: -1 }, { pieces: 0 }, { pieces: 1.5 }, { weightKg: -1 }, { freight: 'Infinity' }, { origin: '' }, { customer: true }]) {
        assert.notEqual((await call('POST', '/orders', { ...payload, ...change })).code, 0)
      }
      const previous = (await call<OrderStats>('GET', '/orders/stats')).data.todayCount
      const order = await call<Order>('POST', '/orders', payload)
      assert.equal(order.code, 0)
      assert.equal((await call<OrderStats>('GET', '/orders/stats')).data.todayCount, previous + 1)
      const id = order.data.id
      for (const status of ['INVALID', 'CANCELLED', null]) {
        assert.equal((await call('PUT', `/orders/${id}/status`, { status })).code, 1004)
      }
      const listed = await call<PageResult<Order>>('GET', '/orders', undefined, { keyword: 'english customer', page: 1, pageSize: 10 })
      assert.equal(listed.data.list[0].status, 'PENDING')
      assert.equal((await call('PUT', `/orders/${id}/status`, { status: 'SIGNED' })).code, 0)
    })

    it('rejects invalid pagination and preserves inventory timestamps on reads', async () => {
      const queries: Record<string, string | number>[] = [{ page: 0 }, { pageSize: -1 }, { page: 1.5 }, { pageSize: 101 }, { page: 'abc' }]
      for (const params of queries) {
        assert.notEqual((await call('GET', '/orders', undefined, params)).code, 0)
      }
      const first = await stock()
      const second = await stock()
      assert.deepEqual(second, first)
    })

    if (name === 'HTTP API') {
      it('requires an issued token for every protected endpoint', async () => {
        for (const path of ['/auth/profile', '/inventory', '/waybills', '/orders', '/orders/stats']) {
          for (const auth of ['', 'Bearer ', 'Bearer forged-token']) {
            const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: auth } })
            assert.equal(res.status, 401)
          }
        }
        for (const [method, path] of [['POST', '/waybills'], ['POST', '/orders'], ['PUT', '/waybills/missing/status'], ['PUT', '/orders/missing/status']]) {
          assert.equal((await fetch(`${baseUrl}${path}`, { method, headers: { Authorization: 'Bearer forged' } })).status, 401)
        }
        assert.equal((await httpCall('GET', '/auth/profile')).code, 0)
      })

      it('returns client errors for malformed bodies and URLs without crashing', async () => {
        for (const body of ['{', 'null', '[]', '42']) {
          assert.equal((await fetch(`${baseUrl}/orders`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })).status, 400)
        }
        const oversized = await fetch(`${baseUrl}/orders`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: 'x'.repeat(1_000_001) })
        assert.equal(oversized.status, 413)
        assert.equal((await fetch(`${baseUrl}/orders/%ZZ/status`, { method: 'PUT' })).status, 400)
        assert.equal((await httpCall('GET', '/inventory')).code, 0)
      })
    }
  })
}
