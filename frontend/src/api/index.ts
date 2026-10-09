import { request } from '@/lib/request'
import type { CreateShipmentPayload, InventoryItem, LoginPayload, LoginResult, Shipment, ShipmentStatus, User } from '@/types'

export const authApi = {
  login: (data: LoginPayload) => request<LoginResult>('/auth/login', { method: 'POST', data }),
  profile: () => request<User>('/auth/profile'),
}

export const inventoryApi = {
  list: () => request<InventoryItem[]>('/items'),
}

// Orders and waybills are two views of the same persisted shipments.
export const shipmentApi = {
  list: () => request<Shipment[]>('/shipments'),
  create: (data: CreateShipmentPayload) => request<Shipment>('/shipments', { method: 'POST', data }),
  updateStatus: (id: number, status: ShipmentStatus) =>
    request<Shipment>(`/shipments/${id}/status`, { method: 'PATCH', data: { status } }),
}
