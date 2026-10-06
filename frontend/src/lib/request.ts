/**
 * 请求封装（Request Wrapper）
 *
 * 职责：
 * 1. 统一 baseURL / 请求头 / Token 注入；
 * 2. 统一响应壳 { code, message, data } 的解包与错误规范化；
 * 3. Mock 模式：VITE_USE_MOCK !== 'false' 时，请求被路由到本地 Mock 数据层，
 *    后端就绪后仅切换环境变量即可，业务代码零改动。
 */
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
  /** 请求体（POST/PUT） */
  data?: unknown
  /** 查询参数（GET） */
  params?: Record<string, string | number | undefined>
  signal?: AbortSignal
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
/** 默认走真实后端；仅当显式设置 VITE_USE_MOCK=true 时才启用本地 Mock */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
/** 与 src/stores/auth.ts 的 persist key 保持一致 */
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

/** Mock 模式：路由到本地数据层，模拟网络延迟 */
async function mockRequest<T>(url: string, options: RequestOptions): Promise<T> {
  const handler = matchMock(options.method ?? 'GET', url)
  if (!handler) {
    throw new ApiError(404, `Mock 接口未定义: ${options.method ?? 'GET'} ${url}`)
  }
  // 模拟 150~450ms 网络延迟，便于展示加载态
  await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 300))
  const payload = handler({ data: options.data, params: options.params })
  return unwrap<T>(payload as { code: number; message: string; data: T })
}

/** 真实模式：标准 fetch 实现 */
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
    throw new ApiError(-1, '网络异常，请检查网络连接')
  }

  if (res.status === 401) {
    // 登录态失效：清空本地状态并回到登录页
    localStorage.removeItem(AUTH_STORAGE_KEY)
    window.location.href = '/login'
    throw new ApiError(401, '登录已过期，请重新登录')
  }
  if (!res.ok) {
    throw new ApiError(res.status, `请求失败（HTTP ${res.status}）`)
  }
  const payload = (await res.json()) as { code: number; message: string; data: T }
  return unwrap<T>(payload)
}

/** 统一解包响应壳；非 0 code 一律抛为 ApiError */
function unwrap<T>(payload: { code: number; message: string; data: T }): T {
  if (payload.code !== 0) {
    throw new ApiError(payload.code, payload.message || '服务异常')
  }
  return payload.data
}
