import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { orderApi } from '@/api'
import { ApiError } from '@/lib/request'
import { CITIES, DRIVERS } from '@/lib/constants'
import { ORDER_STATUS_META } from '@/lib/order-meta'
import type { Order, OrderStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { cn } from '@/lib/utils'

const inputCls = 'h-10 border-input bg-card'

interface CreateOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateOrderDialog({ open, onOpenChange, onCreated }: CreateOrderDialogProps) {
  const [form, setForm] = useState({
    customer: '',
    origin: '',
    destination: '',
    cargo: '',
    pieces: '',
    weightKg: '',
    freight: '',
    driver: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customer.trim() || !form.origin || !form.destination || !form.cargo.trim()) {
      toast.error('Complete the customer, route and cargo details')
      return
    }
    setLoading(true)
    try {
      const order = await orderApi.create({
        customer: form.customer.trim(),
        origin: form.origin,
        destination: form.destination,
        cargo: form.cargo.trim(),
        pieces: form.pieces === '' ? 1 : Number(form.pieces),
        weightKg: form.weightKg === '' ? 0 : Number(form.weightKg),
        freight: form.freight === '' ? 0 : Number(form.freight),
        driver: form.driver || undefined,
      })
      toast.success(`Order created:  ${order.orderNo}`)
      setForm({ customer: '', origin: '', destination: '', cargo: '', pieces: '', weightKg: '', freight: '', driver: '' })
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to create order. Please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>Enter the customer, route and cargo details. New orders start as Pending pickup.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="ui-label">Customer company *</Label>
            <Input value={form.customer} onChange={(e) => set('customer')(e.target.value)} placeholder="e.g. South China Electronics" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Driver</Label>
            <Select value={form.driver} onValueChange={set('driver')}>
              <SelectTrigger className={cn('w-full', inputCls)}>{form.driver || 'Unassigned'}</SelectTrigger>
              <SelectContent>
                {DRIVERS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Origin city *</Label>
            <Select value={form.origin} onValueChange={set('origin')}>
              <SelectTrigger className={cn('w-full', inputCls)}>{form.origin || 'Select city'}</SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Destination city *</Label>
            <Select value={form.destination} onValueChange={set('destination')}>
              <SelectTrigger className={cn('w-full', inputCls)}>{form.destination || 'Select city'}</SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">Cargo name *</Label>
            <Input value={form.cargo} onChange={(e) => set('cargo')(e.target.value)} placeholder="e.g. Electronic components" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Pieces</Label>
            <Input type="number" min={1} value={form.pieces} onChange={(e) => set('pieces')(e.target.value)} placeholder="1" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">Weight (kg)</Label>
            <Input type="number" min={0} value={form.weightKg} onChange={(e) => set('weightKg')(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">Freight (CNY)</Label>
            <Input type="number" min={0} value={form.freight} onChange={(e) => set('freight')(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Submitting…' : 'Create order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface StatusSelectProps {
  order: Order
  disabled?: boolean
  onChange: (id: string, status: OrderStatus) => void
}

export function StatusSelect({ order, disabled, onChange }: StatusSelectProps) {
  const meta = ORDER_STATUS_META[order.status]
  return (
    <Select
      value={order.status}
      disabled={disabled}
      onValueChange={(v) => onChange(order.id, v as OrderStatus)}
    >
      <SelectTrigger className={cn('h-8 w-40 border-transparent bg-transparent px-2 text-sm shadow-none hover:border-input', meta.text)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ORDER_STATUS_META) as OrderStatus[]).map((s) => (
          <SelectItem key={s} value={s}>{ORDER_STATUS_META[s].label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
