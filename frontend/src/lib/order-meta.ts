import type { OrderStatus, WaybillStatus } from '@/types'

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: 'Pending pickup', dot: 'bg-amber-400', text: 'text-amber-300' },
  IN_TRANSIT: { label: 'In transit', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  DELIVERING: { label: 'Out for delivery', dot: 'bg-sky-400', text: 'text-sky-300' },
  SIGNED: { label: 'Delivered', dot: 'bg-zinc-400', text: 'text-zinc-300' },
  EXCEPTION: { label: 'Exception', dot: 'bg-red-400', text: 'text-red-300' },
}

export const STATUS_TABS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending pickup' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERING', label: 'Out for delivery' },
  { value: 'SIGNED', label: 'Delivered' },
  { value: 'EXCEPTION', label: 'Exception' },
]

export const WAYBILL_STATUS_META: Record<WaybillStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: 'Pending pickup', dot: 'bg-amber-400', text: 'text-amber-300' },
  IN_TRANSIT: { label: 'In transit', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  DELIVERING: { label: 'Out for delivery', dot: 'bg-sky-400', text: 'text-sky-300' },
  SIGNED: { label: 'Delivered', dot: 'bg-zinc-400', text: 'text-zinc-300' },
  EXCEPTION: { label: 'Exception', dot: 'bg-red-400', text: 'text-red-300' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-zinc-600', text: 'text-zinc-400' },
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatCurrency(n: number): string {
  return `¥${n.toLocaleString('en-GB')}`
}
