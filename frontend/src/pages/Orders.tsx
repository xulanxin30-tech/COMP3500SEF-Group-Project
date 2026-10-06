import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, TriangleAlert, Truck, PackageCheck, CalendarClock, FilePlus2 } from 'lucide-react'
import { toast } from 'sonner'
import { orderApi } from '@/api'
import { ApiError } from '@/lib/request'
import { ORDER_STATUS_META, STATUS_TABS, formatCurrency, formatDateTime } from '@/lib/order-meta'
import type { Order, OrderStats, OrderStatus, PageResult } from '@/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateOrderDialog, StatusSelect } from '@/pages/order-dialogs'

const PAGE_SIZE = 10

export default function Orders() {
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [keyword, setKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageResult<Order> | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const [pageResult, statsResult] = await Promise.all([
        orderApi.list({ page, pageSize: PAGE_SIZE, status, keyword: submittedKeyword }),
        orderApi.stats(),
      ])
      if (currentRequest !== requestId.current) return
      const lastPage = Math.max(1, Math.ceil(pageResult.total / PAGE_SIZE))
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setData(pageResult)
      setStats(statsResult)
    } catch (err) {
      if (currentRequest !== requestId.current) return
      toast.error(err instanceof ApiError ? err.message : 'Unable to load orders')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [page, status, submittedKeyword])

  useEffect(() => {
    const requests = requestId
    const frame = requestAnimationFrame(() => { void load() })
    return () => {
      cancelAnimationFrame(frame)
      requests.current++
    }
  }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSubmittedKeyword(keyword.trim())
  }

  function handleTabChange(next: OrderStatus | 'ALL') {
    setStatus(next)
    setPage(1)
  }

  async function handleStatusChange(id: string, next: OrderStatus) {
    setUpdatingId(id)
    try {
      await orderApi.updateStatus(id, next)
      toast.success(`Status updated to ${ORDER_STATUS_META[next].label}`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const statCards = [
    { label: 'Orders today', value: stats?.todayCount, suffix: 'orders', icon: CalendarClock },
    { label: 'Orders in transit', value: stats?.inTransit, suffix: 'orders', icon: Truck },
    { label: 'Orders with exceptions', value: stats?.exception, suffix: 'orders', icon: TriangleAlert, danger: true },
    { label: 'Delivery rate', value: stats?.signedRate, suffix: '%', icon: PackageCheck },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="ui-label">ORDER MANAGEMENT</div>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">Orders</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-10">
          <FilePlus2 className="mr-2 h-4 w-4" />
          New order
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map(({ label, value, suffix, icon: Icon, danger }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="ui-label">{label}</span>
              <Icon className={cn('h-4 w-4', danger ? 'text-red-300' : 'text-muted-foreground')} />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              {value === undefined ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <span
                    className={cn(
                      'font-display text-3xl font-semibold tracking-tight',
                      danger && value > 0 ? 'text-red-300' : 'text-foreground',
                    )}
                  >
                    {value}
                  </span>
                  <span className="text-xs text-muted-foreground">{suffix}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm transition-colors',
                status === tab.value
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search order, customer, cargo or driver"
              className="h-10 w-72 border-input bg-card pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-10">
            Search
          </Button>
        </form>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="ui-label w-44">Order number</TableHead>
              <TableHead className="ui-label">Customer</TableHead>
              <TableHead className="ui-label">Route</TableHead>
              <TableHead className="ui-label">Cargo</TableHead>
              <TableHead className="ui-label text-right">Weight</TableHead>
              <TableHead className="ui-label text-right">Freight</TableHead>
              <TableHead className="ui-label">Driver</TableHead>
              <TableHead className="ui-label">Status</TableHead>
              <TableHead className="ui-label w-36">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && data?.list.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageCheck className="h-8 w-8 opacity-40" />
                    <span className="text-sm">No matching orders</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              data?.list.map((order) => (
                <TableRow key={order.id} className="border-border">
                  <TableCell className="font-display text-sm font-medium text-primary">
                    {order.orderNo}
                  </TableCell>
                  <TableCell className="text-sm">{order.customer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.origin} → {order.destination}
                  </TableCell>
                  <TableCell className="text-sm">{order.cargo}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {order.weightKg.toLocaleString('en-GB')} kg
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(order.freight)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{order.driver}</TableCell>
                  <TableCell>
                    <StatusSelect order={order} disabled={updatingId === order.id} onChange={handleStatusChange} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {data?.total ?? 0} orders · Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CreateOrderDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  )
}
