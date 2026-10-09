import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Loader2, LockKeyhole, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { authApi } from '@/api'
import { ApiError } from '@/lib/request'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Enter your username and password')
      return
    }
    setLoading(true)
    try {
      const { token, user } = await authApi.login({ username: username.trim(), password })
      setAuth(token, user)
      toast.success(`Welcome back, ${user.username}`)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/orders', { replace: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(220 9% 20%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 9% 20%) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="led bg-primary text-primary" />
            <span className="ui-label">Logistics Management System</span>
          </div>
          <h1 className="font-display mt-16 text-6xl font-semibold leading-[1.05] tracking-tight">
            Yunlian Logistics
            <br />
            <span className="text-primary">Operations console</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
            Order management, transport scheduling and delivery tracking.
            A shared workspace for logistics operations.
          </p>
        </div>
        <div className="relative space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="led bg-primary text-primary" />
            Local logistics demo
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="led bg-amber-400 text-amber-400" />
            Sign in, check inventory and create waybills.
          </div>
        </div>
      </div>
      <div className="flex w-full items-center justify-center px-6 lg:w-[480px] lg:shrink-0">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="led bg-primary text-primary" />
              <span className="ui-label">Logistics Management System</span>
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">Sign in with the demo account below.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="ui-label">Username</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="demo"
                  autoComplete="username"
                  className="h-11 border-input bg-card pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="ui-label">Password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  className="h-11 border-input bg-card pl-10"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className="rounded-md border border-dashed border-border bg-card/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <span className="ui-label mr-2">Demo account</span>
            Username <code className="text-foreground">demo</code> · Password{' '}
            <code className="text-foreground">demo123</code>
          </div>
        </form>
      </div>
    </div>
  )
}
