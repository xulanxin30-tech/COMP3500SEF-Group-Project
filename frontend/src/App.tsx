import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import AppLayout from '@/components/AppLayout'
import Login from '@/pages/Login'
import Orders from '@/pages/Orders'
import Inventory from '@/pages/Inventory'
import Waybills from '@/pages/Waybills'
import ComingSoon from '@/pages/ComingSoon'
import { useIsAuthed } from '@/stores/auth'

/** 路由守卫：未登录访问业务页面时重定向到登录页 */
function RequireAuth() {
  const isAuthed = useIsAuthed()
  const location = useLocation()
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/orders" replace />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/waybills" element={<Waybills />} />
            {/* P1 阶段先占位，P2 迭代实现 */}
            <Route path="/dashboard" element={<ComingSoon />} />
            <Route path="/tracking" element={<ComingSoon />} />
            <Route path="/fleet" element={<ComingSoon />} />
            <Route path="/customers" element={<ComingSoon />} />
            <Route path="/settings" element={<ComingSoon />} />
            <Route path="*" element={<Navigate to="/orders" replace />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="top-center" theme="dark" richColors />
    </>
  )
}
