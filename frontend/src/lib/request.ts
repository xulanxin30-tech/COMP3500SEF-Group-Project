/** Call the shared Python API and preserve its HTTP status and error message. */
import { useAuthStore } from '@/stores/auth'

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  data?: unknown
  signal?: AbortSignal
}

const BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = useAuthStore.getState().token
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
      signal: options.signal,
    })
  } catch {
    throw new ApiError(-1, 'Network error. Check your connection')
  }

  const payload: unknown = await response.json()
  if (response.status === 401 && url !== '/auth/login') {
    useAuthStore.getState().logout()
    window.location.href = '/login'
    throw new ApiError(401, 'Session expired. Please sign in again')
  }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      && typeof payload.error === 'string' ? payload.error : `Request failed (HTTP ${response.status})`
    throw new ApiError(response.status, message)
  }
  return payload as T
}
