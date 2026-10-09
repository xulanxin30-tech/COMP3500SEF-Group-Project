import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryApi, shipmentApi } from '@/api'
import { ApiError } from '@/lib/request'
import { SHIPMENT_STATUS_META, formatDateTime } from '@/lib/order-meta'
import { useAuthStore } from '@/stores/auth'
import type { InventoryItem, Shipment, ShipmentStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const inputCls = 'h-10 border-input bg-card'
const PAGE_SIZE = 10

export default function Waybills({ title = 'Waybills' }: { title?: string }) {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<ShipmentStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const [rows, items] = await Promise.all([shipmentApi.list(), inventoryApi.list()])
      if (currentRequest !== requestId.current) return
      setShipments(rows)
      setInventory(items)
    } catch (error) {
      if (currentRequest === requestId.current) {
        toast.error(error instanceof ApiError ? error.message : 'Unable to load data')
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

  async function handleStatusChange(id: number, next: ShipmentStatus) {
    setUpdatingId(id)
    try {
      await shipmentApi.updateStatus(id, next)
      toast.success(`Status updated to ${SHIPMENT_STATUS_META[next].label}`)
      await load()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Unable to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const search = keyword.trim().toLowerCase()
  const filtered = shipments.filter((shipment) =>
    (status === 'all' || shipment.status === status) &&
    [shipment.tracking_number, shipment.sender ?? '', shipment.receiver_name, shipment.delivery_address,
      ...shipment.items.flatMap((item) => [item.sku ?? '', item.item_name])]
      .some((text) => text.toLowerCase().includes(search)),
  ).sort((left, right) => right.id - left.id)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="ui-label">SHIPMENT MANAGEMENT</div>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />New waybill
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {([
          ['Total shipments', shipments.length],
          ['Pending pickup', shipments.filter((row) => row.status === 'pending').length],
          ['In transit', shipments.filter((row) => row.status === 'shipped').length],
          ['Delivered', shipments.filter((row) => row.status === 'delivered').length],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="ui-label">{label}</div>
            {loading ? <Skeleton className="mt-3 h-8 w-16" /> :
              <div className="font-display mt-3 text-3xl font-semibold">{value}</div>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Select value={status} onValueChange={(value) => { setStatus(value as ShipmentStatus | 'all'); setPage(1) }}>
          <SelectTrigger aria-label="Filter status" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(SHIPMENT_STATUS_META).map(([value, meta]) =>
              <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search shipments" value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setPage(1) }}
            placeholder="Search tracking number, receiver or SKU" className="h-10 w-80 border-input bg-card pl-9" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="ui-label">Tracking number</TableHead>
            <TableHead className="ui-label">Cargo / SKU / Quantity</TableHead>
            <TableHead className="ui-label">Sender → Receiver</TableHead>
            <TableHead className="ui-label">Delivery address</TableHead>
            <TableHead className="ui-label">Created / Updated</TableHead>
            <TableHead className="ui-label">Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && Array.from({ length: 4 }, (_, row) => (
              <TableRow key={row}>{Array.from({ length: 6 }, (_, cell) =>
                <TableCell key={cell}><Skeleton className="h-4 w-full max-w-28" /></TableCell>)}</TableRow>
            ))}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="h-40 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />No matching shipments
              </TableCell></TableRow>
            )}
            {!loading && rows.map((shipment) => (
              <TableRow key={shipment.id}>
                <TableCell className="font-display font-medium text-primary">{shipment.tracking_number}</TableCell>
                <TableCell>{shipment.items.map((item, index) => (
                  <div key={index} className="mb-1">
                    {item.item_name}
                    <div className="text-xs text-muted-foreground">{item.sku ?? '—'} · {item.quantity}</div>
                  </div>
                ))}</TableCell>
                <TableCell>{shipment.sender ?? '—'} → {shipment.receiver_name}
                  <div className="text-xs text-muted-foreground">{shipment.receiver_phone}</div>
                </TableCell>
                <TableCell className="max-w-60 whitespace-normal">{shipment.delivery_address}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div>{formatDateTime(shipment.created_at)}</div>
                  <div>{formatDateTime(shipment.updated_at)}</div>
                </TableCell>
                <TableCell>
                  <Select value={shipment.status} disabled={updatingId === shipment.id}
                    onValueChange={(value) => handleStatusChange(shipment.id, value as ShipmentStatus)}>
                    <SelectTrigger aria-label={`Status for ${shipment.tracking_number}`}
                      className={cn('h-8 w-40 bg-card text-xs', SHIPMENT_STATUS_META[shipment.status].text)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{Object.entries(SHIPMENT_STATUS_META).map(([value, meta]) =>
                      <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">{filtered.length} shipments · Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={currentPage <= 1 || loading}
              onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={currentPage >= totalPages || loading}
              onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
        </div>
      </div>
      <CreateWaybillDialog open={createOpen} inventory={inventory} onOpenChange={setCreateOpen} onCreated={load} />
    </div>
  )
}

interface CreateWaybillDialogProps {
  open: boolean
  inventory: InventoryItem[]
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

function CreateWaybillDialog({ open, inventory, onOpenChange, onCreated }: CreateWaybillDialogProps) {
  const user = useAuthStore((state) => state.user)
  const [sku, setSku] = useState('')
  const [quantity, setQuantity] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const item = inventory.find((entry) => entry.sku === sku)
  const qty = Number(quantity)
  const insufficient = Boolean(item) && qty > (item?.stock_quantity ?? 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !item || !Number.isSafeInteger(qty) || qty <= 0 ||
        !receiverName.trim() || !receiverPhone.trim() || !address.trim()) {
      toast.error('Select a SKU and enter a positive quantity, receiver, phone and address')
      return
    }
    setLoading(true)
    try {
      const shipment = await shipmentApi.create({
        sender_id: user.id,
        sku,
        quantity: qty,
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        delivery_address: address.trim(),
      })
      toast.success(`Waybill ${shipment.tracking_number} created. Stock deducted: ${qty}`)
      setSku(''); setQuantity(''); setReceiverName(''); setReceiverPhone(''); setAddress('')
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Unable to create waybill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>New waybill</DialogTitle>
          <DialogDescription>Stock is deducted when the waybill is created. Sender: {user?.username}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="waybill-sku" className="ui-label">SKU *</Label>
            <Select value={sku} onValueChange={setSku}>
              <SelectTrigger id="waybill-sku" className={cn('w-full', inputCls)}><SelectValue placeholder="Select SKU" /></SelectTrigger>
              <SelectContent>{inventory.filter((entry) => entry.sku !== null).map((entry) => (
                <SelectItem key={entry.id} value={entry.sku!}>
                  {entry.sku} · {entry.item_name} (available: {entry.stock_quantity})
                </SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="waybill-quantity" className="ui-label">Quantity *</Label>
            <Input id="waybill-quantity" type="number" min={1} step={1} required value={quantity}
              onChange={(event) => setQuantity(event.target.value)} className={inputCls} />
          </div>
          {item && <div className="col-span-2 rounded-md border border-border px-3 py-2 text-xs">
            Available stock: {item.stock_quantity}
            {insufficient && <span className="ml-2 text-red-300">Exceeds available stock</span>}
          </div>}
          <div className="space-y-2">
            <Label htmlFor="waybill-receiver" className="ui-label">Receiver *</Label>
            <Input id="waybill-receiver" required value={receiverName}
              onChange={(event) => setReceiverName(event.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waybill-phone" className="ui-label">Receiver phone *</Label>
            <Input id="waybill-phone" type="tel" required value={receiverPhone}
              onChange={(event) => setReceiverPhone(event.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="waybill-address" className="ui-label">Delivery address *</Label>
            <Input id="waybill-address" required value={address}
              onChange={(event) => setAddress(event.target.value)} className={inputCls} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || insufficient || !user}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Submitting…' : 'Create and deduct stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
