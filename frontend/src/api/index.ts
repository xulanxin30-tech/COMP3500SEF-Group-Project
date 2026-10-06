/** Typed API entry points shared by pages in HTTP and mock modes. */
import { request } from '@/lib/request'
import type {
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

export const authApi = {
  login: (data: LoginPayload) => request<LoginResult>('/auth/login', { method: 'POST', data }),
  profile: () => request<User>('/auth/profile'),
}

export const orderApi = {
  list: (query: OrderQuery) =>
    request<PageResult<Order>>('/orders', {
      params: {
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        keyword: query.keyword || undefined,
      },
    }),
  stats: () => request<OrderStats>('/orders/stats'),

  create: (data: CreateOrderPayload) => request<Order>('/orders', { method: 'POST', data }),

  updateStatus: (id: string, status: OrderStatus) =>
    request<Order>(`/orders/${id}/status`, { method: 'PUT', data: { status } }),
}

export const inventoryApi = {
  list: () => request<InventoryItem[]>('/inventory'),
}

export const waybillApi = {
  list: () => request<Waybill[]>('/waybills'),

  create: (data: CreateWaybillPayload) => request<Waybill>('/waybills', { method: 'POST', data }),

  updateStatus: (id: string, status: WaybillStatus) =>
    request<Waybill>(`/waybills/${id}/status`, { method: 'PUT', data: { status } }),
}
