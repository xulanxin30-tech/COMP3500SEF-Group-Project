import type { OrderStatus, WaybillStatus } from '@/types'

/** 订单状态展示元数据：label + LED 状态灯颜色 */
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: '待揽收', dot: 'bg-amber-400', text: 'text-amber-300' },
  IN_TRANSIT: { label: '运输中', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  DELIVERING: { label: '派送中', dot: 'bg-sky-400', text: 'text-sky-300' },
  SIGNED: { label: '已签收', dot: 'bg-zinc-400', text: 'text-zinc-300' },
  EXCEPTION: { label: '异常', dot: 'bg-red-400', text: 'text-red-300' },
}

export const STATUS_TABS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待揽收' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'DELIVERING', label: '派送中' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'EXCEPTION', label: '异常' },
]

/** 运单状态展示元数据 */
export const WAYBILL_STATUS_META: Record<WaybillStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: '待揽收', dot: 'bg-amber-400', text: 'text-amber-300' },
  IN_TRANSIT: { label: '运输中', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  DELIVERING: { label: '派送中', dot: 'bg-sky-400', text: 'text-sky-300' },
  SIGNED: { label: '已签收', dot: 'bg-zinc-400', text: 'text-zinc-300' },
  EXCEPTION: { label: '异常', dot: 'bg-red-400', text: 'text-red-300' },
  CANCELLED: { label: '已取消', dot: 'bg-zinc-600', text: 'text-zinc-400' },
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatCurrency(n: number): string {
  return `¥${n.toLocaleString('zh-CN')}`
}
