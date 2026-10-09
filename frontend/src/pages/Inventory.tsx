import { useCallback, useEffect, useRef, useState } from 'react'
import { Boxes, Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryApi } from '@/api'
import { ApiError } from '@/lib/request'
import { formatCurrency } from '@/lib/order-meta'
import type { InventoryItem } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function Inventory() {
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const data = await inventoryApi.list()
      if (currentRequest === requestId.current) setList(data)
    } catch (error) {
      if (currentRequest === requestId.current) {
        toast.error(error instanceof ApiError ? error.message : 'Unable to load inventory')
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const requests = requestId
    const frame = requestAnimationFrame(() => { void load() })
    return () => {
      cancelAnimationFrame(frame)
      requests.current++
    }
  }, [load])

  const search = keyword.trim().toLowerCase()
  const filtered = list.filter((item) =>
    [item.sku ?? '', item.item_name].some((text) => text.toLowerCase().includes(search)),
  )
  const totalQuantity = filtered.reduce((sum, item) => sum + item.stock_quantity, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="ui-label">INVENTORY</div>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">Inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search inventory" value={keyword} onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search SKU or item name" className="h-10 w-72 border-input bg-card pl-9" />
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {([['Items', filtered.length], ['Available stock', totalQuantity]] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="ui-label">{label}</div>
            {loading ? <Skeleton className="mt-3 h-8 w-16" /> :
              <div className="font-display mt-3 text-3xl font-semibold">{value.toLocaleString('en-GB')}</div>}
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ui-label">SKU</TableHead>
              <TableHead className="ui-label">Item name</TableHead>
              <TableHead className="ui-label text-right">Available stock</TableHead>
              <TableHead className="ui-label text-right">Unit price (HKD)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 3 }, (_, row) => (
              <TableRow key={row}>{Array.from({ length: 4 }, (_, cell) =>
                <TableCell key={cell}><Skeleton className="h-4 w-full max-w-28" /></TableCell>)}</TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="h-40 text-center">
                <Boxes className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />No matching inventory records
              </TableCell></TableRow>
            )}
            {!loading && filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-display text-primary">{item.sku ?? '—'}</TableCell>
                <TableCell>{item.item_name}</TableCell>
                <TableCell className="text-right tabular-nums">{item.stock_quantity.toLocaleString('en-GB')}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
