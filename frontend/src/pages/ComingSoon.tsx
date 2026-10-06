import { useLocation } from 'react-router'
import { HardHat } from 'lucide-react'

const MODULE_NAMES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/tracking': 'Tracking',
  '/fleet': 'Fleet',
  '/customers': 'Customers',
  '/settings': 'Settings',
}

export default function ComingSoon() {
  const { pathname } = useLocation()
  const name = MODULE_NAMES[pathname] ?? 'This module'

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-border bg-card">
        <HardHat className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold">{name}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          This module is planned for a future iteration.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="led bg-amber-400 text-amber-400" />
        Planned for a future iteration
      </div>
    </div>
  )
}
