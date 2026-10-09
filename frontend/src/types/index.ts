/** JSON contracts served by backend/server.py, backed by schema v1.1. */
export interface User {
  id: number
  username: string
  role: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  token_type: 'Bearer'
  user: User
}

export interface InventoryItem {
  id: number
  sku: string | null
  item_name: string
  stock_quantity: number
  unit_price: number
}

export type ShipmentStatus = 'pending' | 'shipped' | 'delivered'

export interface ShipmentItem {
  item_id: number
  sku: string | null
  item_name: string
  quantity: number
}

export interface Shipment {
  id: number
  tracking_number: string
  sender_id: number
  sender: string | null
  receiver_name: string
  receiver_phone: string
  delivery_address: string
  status: ShipmentStatus
  created_at: string
  updated_at: string
  items: ShipmentItem[]
}

export interface CreateShipmentPayload {
  sender_id: number
  receiver_name: string
  receiver_phone: string
  delivery_address: string
  sku: string
  quantity: number
}
