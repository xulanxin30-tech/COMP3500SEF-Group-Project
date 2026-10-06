/**
 * 订单页弹窗组件：新建订单（下单）+ 填运单
 */
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

/* ================= 新建订单（下单） ================= */

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
      toast.error('请完整填写客户、线路与货物信息')
      return
    }
    setLoading(true)
    try {
      const order = await orderApi.create({
        customer: form.customer.trim(),
        origin: form.origin,
        destination: form.destination,
        cargo: form.cargo.trim(),
        pieces: Number(form.pieces) || 1,
        weightKg: Number(form.weightKg) || 0,
        freight: Number(form.freight) || 0,
        driver: form.driver || undefined,
      })
      toast.success(`下单成功，订单号 ${order.orderNo}`)
      setForm({ customer: '', origin: '', destination: '', cargo: '', pieces: '', weightKg: '', freight: '', driver: '' })
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '下单失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>新建订单</DialogTitle>
          <DialogDescription>录入客户、线路与货物信息，提交后订单进入「待揽收」。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="ui-label">客户公司 *</Label>
            <Input value={form.customer} onChange={(e) => set('customer')(e.target.value)} placeholder="如：华南电子科技" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">承运司机</Label>
            <Select value={form.driver} onValueChange={set('driver')}>
              <SelectTrigger className={cn('w-full', inputCls)}>{form.driver || '待分配'}</SelectTrigger>
              <SelectContent>
                {DRIVERS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="ui-label">发货城市 *</Label>
            <Select value={form.origin} onValueChange={set('origin')}>
              <SelectTrigger className={cn('w-full', inputCls)}>{form.origin || '选择城市'}</SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="ui-label">收货城市 *</Label>
            <Select value={form.destination} onValueChange={set('destination')}>
              <SelectTrigger className={cn('w-full', inputCls)}>{form.destination || '选择城市'}</SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">货物名称 *</Label>
            <Input value={form.cargo} onChange={(e) => set('cargo')(e.target.value)} placeholder="如：电子元器件" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">件数</Label>
            <Input type="number" min={1} value={form.pieces} onChange={(e) => set('pieces')(e.target.value)} placeholder="1" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">重量（kg）</Label>
            <Input type="number" min={0} value={form.weightKg} onChange={(e) => set('weightKg')(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">运费（元）</Label>
            <Input type="number" min={0} value={form.freight} onChange={(e) => set('freight')(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? '提交中…' : '提交订单'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ================= 行内改状态 ================= */

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
      <SelectTrigger className={cn('h-8 w-28 border-transparent bg-transparent px-2 text-sm shadow-none hover:border-input', meta.text)}>
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
