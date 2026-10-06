/** Select the HTTP or browser-mock API, inject the session token and unwrap responses. */
import { matchMock } from '@/mock'

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'

  /** JSON body for write requests. */
  data?: unknown

  /** Query parameters; empty and undefined values are omitted. */
  params?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Keep this key in sync with the persisted Zustand auth store.
const AUTH_STORAGE_KEY = 'lms-auth'

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as { state?: { token?: string } }).state?.token ?? null
  } catch {
    return null
  }
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  if (USE_MOCK) {
    return mockRequest<T>(url, options)
  }
  return httpRequest<T>(url, options)
}

async function mockRequest<T>(url: string, options: RequestOptions): Promise<T> {
  const handler = matchMock(options.method ?? 'GET', url)
  if (!handler) {
    throw new ApiError(404, `Mock Endpoint not defined: ${options.method ?? 'GET'} ${url}`)
  }
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 300))
  const payload = handler({ data: options.data, params: options.params })
  return unwrap<T>(payload as { code: number; message: string; data: T })
}

async function httpRequest<T>(url: string, options: RequestOptions): Promise<T> {
  const method = options.method ?? 'GET'
  const query = options.params
    ? '?' +
      Object.entries(options.params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${url}${query}`, {
      method,
      headers,
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
      signal: options.signal,
    })
  } catch {
    throw new ApiError(-1, 'Network error. Check your connection')
  }

  if (res.status === 401) {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    window.location.href = '/login'
    throw new ApiError(401, 'Session expired. Please sign in again')
  }
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (HTTP ${res.status})`)
  }
  const payload = (await res.json()) as { code: number; message: string; data: T }
  return unwrap<T>(payload)
}

function unwrap<T>(payload: { code: number; message: string; data: T }): T {
  if (payload.code !== 0) {
    throw new ApiError(payload.code, payload.message || 'Service error')
  }
  return payload.data
}
