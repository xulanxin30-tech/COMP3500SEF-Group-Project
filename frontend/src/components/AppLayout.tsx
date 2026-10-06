import { NavLink, Outlet, useNavigate } from 'react-router'
import {
  Gauge,
  PackageSearch,
  Route as RouteIcon,
  Truck,
  Users,
  Settings,
  LogOut,
  Boxes,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/orders', label: 'Orders', icon: PackageSearch },
  { to: '/waybills', label: 'Waybills', icon: FileText },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/tracking', label: 'Tracking', icon: RouteIcon },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  function handleLogout() {
    logout()
    toast.success('Signed out')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <span className="led bg-primary text-primary" />
          <div className="leading-tight">
            <div className="font-display text-sm font-semibold text-sidebar-accent-foreground">
              Yunlian Logistics
            </div>
            <div className="ui-label mt-0.5 !text-[10px]">YUNLIAN OPS</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="ui-label !text-[10px]">P2 · Workflow demo</div>
          <div className="mt-1 text-xs text-sidebar-foreground">Orders, inventory and waybills</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <span className="ui-label">YUNLIAN LOGISTICS</span>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              {import.meta.env.VITE_USE_MOCK === 'true' ? 'MOCK' : 'LOCAL API'}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-hidden transition-opacity hover:opacity-80">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                  {user?.displayName?.slice(0, 1) ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground">{user?.displayName ?? 'Signed out'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                <div className="text-sm">{user?.displayName}</div>
                <div className="text-xs font-normal text-muted-foreground">{user?.role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="scrollbar-dark min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
