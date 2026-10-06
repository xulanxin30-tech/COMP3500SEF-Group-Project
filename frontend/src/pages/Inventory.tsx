/**
 * 库存查询：各仓库 SKU 库存、安全库存预警与关键词检索
 */
import { useCallback, useEffect, useState } from 'react'
import { Boxes, Search, TriangleAlert, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryApi } from '@/api'
import { ApiError } from '@/lib/request'
import { formatDateTime } from '@/lib/order-meta'
import type { InventoryItem } from '@/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Inventory() {
  const [keyword, setKeyword] = useState('')
  const [submittedKeyword, setSubmittedKeyword] = useState('')
  const [list, setList] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await inventoryApi.list()
      setList(data)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '库存数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSubmittedKeyword(keyword.trim())
  }

  // 关键词本地过滤（数据量小，无需再走一次请求）
  const kw = submittedKeyword.toLowerCase()
  const filtered = kw
    ? list.filter(
        (i) =>
          i.sku.toLowerCase().includes(kw) ||
          i.name.toLowerCase().includes(kw) ||
          i.category.includes(kw) ||
          i.warehouse.includes(kw),
      )
    : list

  const totalQuantity = filtered.reduce((sum, i) => sum + i.quantity, 0)
  const alertCount = filtered.filter((i) => i.quantity < i.safetyStock).length

  const statCards = [
    { label: 'SKU 总数', value: filtered.length, suffix: '个', icon: Boxes },
    { label: '库存总量', value: totalQuantity, suffix: '', icon: Warehouse },
    { label: '低于安全库存', value: alertCount, suffix: '项', icon: TriangleAlert, danger: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="ui-label">INVENTORY</div>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">库存查询</h1>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索 SKU / 名称 / 类别 / 仓库"
              className="h-10 w-72 border-input bg-card pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-10">
            查询
          </Button>
        </form>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {statCards.map(({ label, value, suffix, icon: Icon, danger }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="ui-label">{label}</span>
              <Icon className={cn('h-4 w-4', danger ? 'text-red-300' : 'text-muted-foreground')} />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <span
                    className={cn(
                      'font-display text-3xl font-semibold tracking-tight',
                      danger && value > 0 ? 'text-red-300' : 'text-foreground',
                    )}
                  >
                    {value.toLocaleString('zh-CN')}
                  </span>
                  <span className="text-xs text-muted-foreground">{suffix}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 库存表格 */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="ui-label w-32">SKU</TableHead>
              <TableHead className="ui-label">货品名称</TableHead>
              <TableHead className="ui-label">类别</TableHead>
              <TableHead className="ui-label">仓库</TableHead>
              <TableHead className="ui-label text-right">可用库存</TableHead>
              <TableHead className="ui-label text-right">安全库存</TableHead>
              <TableHead className="ui-label">状态</TableHead>
              <TableHead className="ui-label w-36">更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && filtered.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell colSpan={8} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Boxes className="h-8 w-8 opacity-40" />
                    <span className="text-sm">没有符合条件的库存记录</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((item) => {
                const low = item.quantity < item.safetyStock
                return (
                  <TableRow key={item.id} className="border-border">
                    <TableCell className="font-display text-sm font-medium text-primary">
                      {item.sku}
                    </TableCell>
                    <TableCell className="text-sm">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-sm">{item.warehouse}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {item.quantity.toLocaleString('zh-CN')} {item.unit}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {item.safetyStock}
                    </TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive" className="gap-1">
                          <TriangleAlert className="h-3 w-3" />
                          需补货
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                          正常
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatDateTime(item.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
