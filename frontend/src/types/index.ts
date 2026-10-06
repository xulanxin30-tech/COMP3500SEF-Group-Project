/**
 * 全局类型定义
 * 物流管理系统（Logistics Management System）
 */

/** 订单状态 */
export type OrderStatus =
  | 'PENDING' // 待揽收
  | 'IN_TRANSIT' // 运输中
  | 'DELIVERING' // 派送中
  | 'SIGNED' // 已签收
  | 'EXCEPTION' // 异常

export interface Order {
  id: string
  /** 订单号，如 YD20260916001 */
  orderNo: string
  /** 客户公司 */
  customer: string
  /** 发货城市 */
  origin: string
  /** 收货城市 */
  destination: string
  /** 货物名称 */
  cargo: string
  /** 件数 */
  pieces: number
  /** 重量（kg） */
  weightKg: number
  /** 运费（元） */
  freight: number
  status: OrderStatus
  /** 承运司机 */
  driver: string
  /** 创建时间 ISO 字符串 */
  createdAt: string
  /** 最近更新时间 ISO 字符串 */
  updatedAt: string
}

export interface User {
  id: string
  username: string
  displayName: string
  role: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: User
}

export interface OrderQuery {
  page: number
  pageSize: number
  status?: OrderStatus | 'ALL'
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface OrderStats {
  todayCount: number
  inTransit: number
  exception: number
  signedRate: number
}

/** 下单请求体 */
export interface CreateOrderPayload {
  customer: string
  origin: string
  destination: string
  cargo: string
  pieces: number
  weightKg: number
  freight: number
  driver?: string
}

/** 库存条目 */
export interface InventoryItem {
  id: string
  sku: string
  name: string
  category: string
  /** 所在仓库 */
  warehouse: string
  quantity: number
  unit: string
  /** 安全库存，低于该值触发预警 */
  safetyStock: number
  updatedAt: string
}

/** 运单状态 */
export type WaybillStatus =
  | 'PENDING' // 待揽收
  | 'IN_TRANSIT' // 运输中
  | 'DELIVERING' // 派送中
  | 'SIGNED' // 已签收
  | 'EXCEPTION' // 异常
  | 'CANCELLED' // 已取消（回补库存）

/** 运单 */
export interface Waybill {
  id: string
  waybillNo: string
  /** 关联订单号 */
  orderNo: string
  /** 建单时扣减的库存 SKU */
  sku: string
  cargoName: string
  quantity: number
  unit: string
  warehouse: string
  senderName: string
  senderPhone: string
  senderAddress: string
  receiverName: string
  receiverPhone: string
  receiverAddress: string
  status: WaybillStatus
  createdAt: string
  updatedAt: string
}

/** 建运单请求体（sku + quantity 用于扣库存） */
export interface CreateWaybillPayload {
  sku: string
  quantity: number
  orderNo?: string
  senderName: string
  senderPhone?: string
  senderAddress?: string
  receiverName: string
  receiverPhone?: string
  receiverAddress?: string
}

/** 统一后端响应壳 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
