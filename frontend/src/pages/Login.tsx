import { useState } from 'react'
import { useNavigate } from 'react-router'
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
  const setAuth = useAuthStore((s) => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      const { token, user } = await authApi.login({ username: username.trim(), password })
      setAuth(token, user)
      toast.success(`欢迎回来，${user.displayName}`)
      navigate('/orders', { replace: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* 左侧品牌区 */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex">
        {/* 网格背景纹理 */}
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
            云链物流
            <br />
            <span className="text-primary">运营调度台</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
            订单全生命周期管理 · 干线运输调度 · 末端派送跟踪。
            面向物流运营团队的一体化管理工作台。
          </p>
        </div>
        <div className="relative space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="led bg-primary text-primary" />
            系统运行正常 · Mock 数据环境
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="led bg-amber-400 text-amber-400" />
            后端 API 联调待启动 · P2 阶段切换
          </div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex w-full items-center justify-center px-6 lg:w-[480px] lg:shrink-0">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3 lg:hidden">
              <span className="led bg-primary text-primary" />
              <span className="ui-label">Logistics Management System</span>
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">登录</h2>
            <p className="text-sm text-muted-foreground">使用团队分配的账号进入调度台</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="ui-label">用户名</Label>
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
              <Label htmlFor="password" className="ui-label">密码</Label>
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
            {loading ? '登录中…' : '进入调度台'}
          </Button>

          <div className="rounded-md border border-dashed border-border bg-card/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <span className="ui-label mr-2">演示账号</span>
            用户名 <code className="text-foreground">demo</code> · 密码{' '}
            <code className="text-foreground">demo123</code>
          </div>
        </form>
      </div>
    </div>
  )
}
