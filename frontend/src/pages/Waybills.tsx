/**
 * 运单管理：建运单（服务端扣减库存）+ 改运单状态 + 运单列表
 */
import { useCallback, useEffect, useState } from 'react'
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wb, inv] = await Promise.all([waybillApi.list(), inventoryApi.list()])
      setWaybills(wb)
      setInventory(inv)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleStatusChange(id: string, status: WaybillStatus) {
    setUpdatingId(id)
    try {
      await waybillApi.updateStatus(id, status)
      toast.success(`运单状态已更新为「${WAYBILL_STATUS_META[status].label}」`)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '状态更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="ui-label">WAYBILL</div>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">运单管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="h-10" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button className="h-10" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新建运单
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="ui-label w-40">运单号</TableHead>
              <TableHead className="ui-label">货物 / SKU</TableHead>
              <TableHead className="ui-label text-right">数量</TableHead>
              <TableHead className="ui-label">发货 → 收货</TableHead>
              <TableHead className="ui-label">仓库</TableHead>
              <TableHead className="ui-label">状态</TableHead>
              <TableHead className="ui-label w-36">创建时间</TableHead>
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
                    <span className="text-sm">还没有运单，点击右上角「新建运单」开始</span>
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
                        <SelectTrigger className="h-8 w-24 border-input bg-card text-xs">
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

/* ================= 建运单弹窗 ================= */

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
    if (!sku || !qty || !senderName.trim() || !receiverName.trim()) {
      toast.error('请选择 SKU 并填写数量、发货人与收货人')
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
      toast.success(`运单 ${wb.waybillNo} 已生成，已扣减 ${wb.quantity}${wb.unit}`)
      setSku(''); setQuantity(''); setSenderName(''); setReceiverName('')
      setSenderAddress(''); setReceiverAddress('')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '建单失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>新建运单</DialogTitle>
          <DialogDescription>提交后服务端校验并扣减对应 SKU 的库存。</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="ui-label">SKU *</Label>
            <Select value={sku} onValueChange={setSku}>
              <SelectTrigger className={cn('w-full', inputCls)}>{sku || '选择 SKU'}</SelectTrigger>
              <SelectContent>
                {inventory.map((i) => (
                  <SelectItem key={i.sku} value={i.sku}>
                    {i.sku} · {i.name}（可用 {i.quantity}{i.unit}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="ui-label">数量 *</Label>
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
                当前可用库存
                <span className="ml-2 font-medium text-foreground">
                  {item.quantity}{item.unit}
                </span>
                {insufficient && <span className="ml-2 text-red-300">· 超出可用库存</span>}
              </span>
              <span className="text-muted-foreground">{item.warehouse}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label className="ui-label">发货人 *</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="姓名" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className="ui-label">收货人 *</Label>
            <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="姓名" className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">发货地址</Label>
            <Input value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="详细地址" className={inputCls} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="ui-label">收货地址</Label>
            <Input value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} placeholder="详细地址" className={inputCls} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            {insufficient && (
              <span className="mr-auto flex items-center gap-1 text-xs text-red-300">
                <PackageX className="h-3.5 w-3.5" />
                库存不足，无法提交
              </span>
            )}
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={loading || insufficient}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? '提交中…' : '提交并扣库存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
