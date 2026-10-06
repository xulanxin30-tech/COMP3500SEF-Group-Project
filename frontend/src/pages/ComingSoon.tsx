import { useLocation } from 'react-router'
import { HardHat } from 'lucide-react'

const MODULE_NAMES: Record<string, string> = {
  '/dashboard': '运营概览',
  '/tracking': '运单跟踪',
  '/fleet': '车辆调度',
  '/customers': '客户管理',
  '/settings': '系统设置',
}

/** P1 阶段占位页：脚手架路由已就位，模块页面在后续迭代交付 */
export default function ComingSoon() {
  const { pathname } = useLocation()
  const name = MODULE_NAMES[pathname] ?? '该模块'

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border bg-card">
        <HardHat className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold">{name}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          路由与页面骨架已在 P1 阶段搭建完成，本模块将在 P2 迭代中接入真实业务页面与后端 API。
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="led bg-amber-400 text-amber-400" />
        P2 迭代开发队列中
      </div>
    </div>
  )
}
