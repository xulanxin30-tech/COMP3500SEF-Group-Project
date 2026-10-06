import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2, PackageX, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryApi, waybillApi } from '@/api'
import { ApiError } from '@/lib/request'
import { WAYBILL_STATUS_META, formatDateTime } from '@/lib/order-meta'
import type { InventoryItem, Waybill, WaybillStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const inputCls = 'h-10 border-input bg-card'

export default function Waybills() {
  const [waybills, setWaybills] = useState<Waybill[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const [wb, inv] = await Promise.all([waybillApi.list(), inventoryApi.list()])
      if (currentRequest !== requestId.current) return
      setWaybills(wb)
      setInventory(inv)
    } catch (err) {
      if (currentRequest !== requestId.current) return
      toast.error(err instanceof ApiError ? err.message : 'Unable to load data')
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

  async function handleStatusChange(id: string, status: WaybillStatus) {
    setUpdatingId(id)
    try {
      await waybillApi.updateStatus(id, status)
      toast.success(`Waybill status updated to ${WAYBILL_STATUS_META[status].label}`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="ui-label">WAYBILL</div>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">Waybills</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="h-10" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button className="h-10" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New waybill
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="ui-label w-40">Waybill number</TableHead>
              <TableHead className="ui-label">Cargo / SKU</TableHead>
              <TableHead className="ui-label text-right">Quantity</TableHead>
              <TableHead className="ui-label">Sender → Receiver</TableHead>
              <TableHead className="ui-label">Warehouse</TableHead>
              <TableHead className="ui-label">Status</TableHead>
              <TableHead className="ui-label w-36">Created</TableHead>
              <TableHead className="ui-label w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && waybills.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8 opacity-40" />
                    <span className="text-sm">No waybills yet. Select New waybill to get started.</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              waybills.map((wb) => {
                const meta = WAYBILL_STATUS_META[wb.status]
                return (
                  <TableRow key={wb.id} className="border-border">
                    <TableCell className="font-display text-sm font-medium text-primary">
                      {wb.waybillNo}
                      <div className="text-[11px] font-normal text-muted-foreground">{wb.orderNo}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {wb.cargoName}
                      <div className="text-[11px] text-muted-foreground">{wb.sku}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {wb.quantity} {wb.unit}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {wb.senderName} → {wb.receiverName}
                    </TableCell>
                    <TableCell className="text-sm">{wb.warehouse}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-2 text-sm', meta.text)}>
                        <span className={cn('led', meta.dot)} />
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatDateTime(wb.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={wb.status}
                        disabled={updatingId === wb.id}
                        onValueChange={(v) => handleStatusChange(wb.id, v as WaybillStatus)}
                      >
                        <SelectTrigger className="h-8 w-40 border-input bg-card text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(WAYBILL_STATUS_META) as WaybillStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{WAYBILL_STATUS_META[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>

      <CreateWaybillDialog
        open={createOpen}
        inventory={inventory}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
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
  const [sku, setSku] = useState('')
  const [quantity, setQuantity] = useState('')
  const [senderName, setSenderName] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [senderAddress, setSenderAddress] = useState('')
  const [receiverAddress, setReceiverAddress] = useState('')
  const [loading, setLoading] = useState(false)

  const item = inventory.find((i) => i.sku === sku)
  const qty = Number(quantity) || 0
  const insufficient = Boolean(item) && qty > (item?.quantity ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sku || !Number.isSafeInteger(qty) || qty <= 0 || !senderName.trim() || !receiverName.trim()) {
      toast.error('Select a SKU and enter quantity, sender and receiver')
      return
    }
    setLoading(true)
    try {
      const wb = await waybillApi.create({
        sku,
        quantity: qty,
        senderName: senderName.trim(),
        senderAddress: senderAddress.trim(),
        receiverName: receiverName.trim(),
        receiverAddress: receiverAddress.trim(),
      })
      toast.success(`Waybill ${wb.waybillNo} created. Stock deducted: ${wb.quantity} ${wb.unit}`)
      setSku(''); setQuantity(''); setSenderName(''); setReceiverName('')
      setSenderAddress(''); setReceiverAddress('')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to create waybill')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>New waybill</DialogTitle>
          <DialogDescription>The server validates the request and deducts stock for the selected SKU.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="ui-label">SKU *</Label>
            <Select value={sku} onValueChange={setSku}>
              <SelectTrigger className={cn('w-full', inputCls)}>{sku || 'Select SKU'}</SelectTrigger>
              <SelectContent>
                {inventory.map((i) => (
                  <SelectItem key={i.sku} value={i.sku}>
                    {i.sku} · {i.name} (available: {i.quantity} {i.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Quantity *</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          {item && (
            <div className="col-span-2 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Available stock
                <span className="ml-2 font-medium text-foreground">
                  {item.quantity} {item.unit}
                </span>
                {insufficient && <span className="ml-2 text-red-300">· Exceeds available stock</span>}
              </span>
              <span className="text-muted-foreground">{item.warehouse}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label className="ui-label">Sender *</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Name" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Receiver *</Label>
            <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Name" className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">Sender address</Label>
            <Input value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="Full address" className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">Receiver address</Label>
            <Input value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} placeholder="Full address" className={inputCls} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            {insufficient && (
              <span className="mr-auto flex items-center gap-1 text-xs text-red-300">
                <PackageX className="h-3.5 w-3.5" />
                Insufficient stock. Cannot submit
              </span>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || insufficient}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Submitting…' : 'Create and deduct stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
