import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} })
Object.defineProperty(globalThis, 'window', { value: { localStorage: globalThis.localStorage, location: { href: '/orders' } } })

// Import the actual page API and request layer after installing browser storage.
const { authApi, inventoryApi, shipmentApi } = await import('../src/api/index')
const { ApiError } = await import('../src/lib/request')
const { useAuthStore } = await import('../src/stores/auth')

const root = fileURLToPath(new URL('../../', import.meta.url))
const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
const nativeFetch = globalThis.fetch
let directory: string
let child: ChildProcess
let baseUrl: string

async function startServer() {
  child = spawn(python, ['-u', '-c', [
    'from backend.server import create_server',
    'with create_server(port=0) as server:',
    '    print(f"LMS_TEST_URL=http://127.0.0.1:{server.server_port}", flush=True)',
    '    server.serve_forever()',
  ].join('\n')], {
    cwd: root,
    env: { ...process.env, LMS_HOST: '127.0.0.1', LMS_DB_PATH: path.join(directory, 'lms.db') },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  baseUrl = await new Promise<string>((resolve, reject) => {
    let stderr = ''
    child.stderr!.on('data', (chunk) => { stderr += String(chunk) })
    const lines = createInterface({ input: child.stdout! })
    const timer = setTimeout(() => reject(new Error('Python server startup timed out: ' + stderr)), 10000)
    const fail = (error: Error) => { clearTimeout(timer); lines.close(); reject(error) }
    child.once('error', fail)
    child.once('exit', (code) => fail(new Error(`Python server exited: ${code} ${stderr}`)))
    lines.on('line', (line) => {
      if (line.startsWith('LMS_TEST_URL=')) {
        clearTimeout(timer)
        lines.close()
        child.stdout!.resume()
        resolve(line.slice('LMS_TEST_URL='.length))
      }
    })
  })
}

async function stopServer() {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
}

async function login() {
  const result = await authApi.login({ username: 'demo', password: 'demo123' })
  useAuthStore.getState().setAuth(result.token, result.user)
  return result.user
}

describe('React API against the shared Python/SQLite backend', () => {
  before(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'lms-frontend-'))
    await startServer()
    globalThis.fetch = (input, init) => nativeFetch(
      typeof input === 'string' && input.startsWith('/api') ? baseUrl + input : input, init,
    )
    await login()
  })
  after(async () => {
    globalThis.fetch = nativeFetch
    await stopServer()
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  it('uses a SQLite user, preserves invalid-login errors and does not redirect on bad credentials', async () => {
    const user = await authApi.profile()
    assert.equal(user.username, 'demo')
    assert.equal(user.id, 4)
    assert.equal('password_hash' in user, false)
    const token = useAuthStore.getState().token
    await assert.rejects(authApi.login({ username: 'demo', password: 'wrong' }),
      (error: unknown) => error instanceof ApiError && error.code === 401 && error.message === 'invalid credentials')
    assert.equal(useAuthStore.getState().token, token)
    assert.equal(window.location.href, '/orders')
  })

  it('lists real inventory and every item on the seeded shipment', async () => {
    const items = await inventoryApi.list()
    assert.deepEqual(items[0], {
      id: 1, sku: 'TECH-WM-001', item_name: 'Wireless Optical Mouse', stock_quantity: 120, unit_price: 150,
    })
    const seeded = (await shipmentApi.list())[0]
    assert.equal(seeded.tracking_number, 'HK202610001')
    assert.equal(seeded.status, 'shipped')
    assert.equal(seeded.items.length, 2)
    assert.equal(seeded.items.reduce((sum, item) => sum + item.quantity, 0), 3)
  })

  it('creates a waybill, deducts stock, patches status, and persists both across restart', async () => {
    const sender = await authApi.profile()
    const item = (await inventoryApi.list())[0]
    const shipment = await shipmentApi.create({
      sender_id: sender.id, sku: item.sku!, quantity: 3,
      receiver_name: 'Integration Receiver', receiver_phone: '+852-91112222', delivery_address: '88 Kwun Tong Road',
    })
    assert.equal(shipment.sender, sender.username)
    assert.equal(shipment.status, 'pending')
    assert.deepEqual(shipment.items, [{
      item_id: item.id, sku: item.sku, item_name: item.item_name, quantity: 3,
    }])
    assert.equal((await inventoryApi.list())[0].stock_quantity, item.stock_quantity - 3)
    const updated = await shipmentApi.updateStatus(shipment.id, 'delivered')
    assert.equal(updated.status, 'delivered')
    assert.equal(updated.receiver_phone, '+852-91112222')
    await stopServer()
    await startServer()
    assert.equal((await inventoryApi.list())[0].stock_quantity, item.stock_quantity - 3)
    const saved = (await shipmentApi.list()).find((row) => row.id === shipment.id)
    assert.deepEqual(saved, updated)
    await assert.rejects(authApi.profile(), (error: unknown) => error instanceof ApiError && error.code === 401)
    assert.equal(useAuthStore.getState().token, null)
    assert.equal(useAuthStore.getState().user, null)
    assert.equal(window.location.href, '/login')
    assert.equal((await login()).id, sender.id)
  })

  it('rejects malformed or insufficient-stock creates without partially writing data', async () => {
    const item = (await inventoryApi.list())[1]
    const sender = await authApi.profile()
    const payload = {
      sender_id: sender.id, sku: item.sku!, quantity: 1,
      receiver_name: 'Bob', receiver_phone: '+852-91112222', delivery_address: 'Central',
    }
    const beforeItems = await inventoryApi.list()
    const beforeShipments = await shipmentApi.list()
    for (const quantity of [0, -1, 1.5]) {
      await assert.rejects(shipmentApi.create({ ...payload, quantity }),
        (error: unknown) => error instanceof ApiError && error.code === 400)
    }
    await assert.rejects(shipmentApi.create({ ...payload, receiver_phone: ' ' }),
      (error: unknown) => error instanceof ApiError && error.code === 400)
    await assert.rejects(shipmentApi.create({ ...payload, quantity: item.stock_quantity + 1 }),
      (error: unknown) => error instanceof ApiError && error.code === 409 && error.message === 'insufficient inventory')
    assert.deepEqual(await inventoryApi.list(), beforeItems)
    assert.deepEqual(await shipmentApi.list(), beforeShipments)
  })

  it('does not oversell when two clients try to consume the same remaining stock', async () => {
    const item = (await inventoryApi.list())[2]
    const sender = await authApi.profile()
    const payload = {
      sender_id: sender.id, sku: item.sku!, quantity: item.stock_quantity,
      receiver_name: 'Concurrent Receiver', receiver_phone: '+852-91112222', delivery_address: 'Shatin',
    }
    const results = await Promise.allSettled([shipmentApi.create(payload), shipmentApi.create(payload)])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = results.find((result) => result.status === 'rejected')
    assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ApiError)
    assert.equal(rejected.reason.code, 409)
    assert.equal((await inventoryApi.list())[2].stock_quantity, 0)
  })
})
