# 云链物流运营调度台（前端 + 本地后端）

React 19 + TypeScript + Vite + Tailwind（shadcn/ui）前端，配一个零依赖的 Node 本地后端。

## P2：已接真实后端，可走通完整流程

流程：**登录 → 看库存 → 建运单（扣库存）→ 改运单状态**

### 启动

```bash
# 1) 启动后端（默认 8080，可用 PORT 覆盖）
npm run server

# 2) 另开一个终端启动前端
npm run dev
```

前端默认走真实后端，配置见 `.env`：

```
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

想回到纯前端 Mock 演示，把 `VITE_USE_MOCK` 改成 `true` 即可（业务代码无需改动）。

### 演示账号

`demo` / `demo123`

### 后端接口（`server/server.js`，零依赖 Node http）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | 登录，返回 token |
| GET | `/api/v1/auth/profile` | 当前登录用户 |
| GET | `/api/v1/inventory` | 库存列表 |
| GET | `/api/v1/waybills` | 运单列表 |
| POST | `/api/v1/waybills` | 建运单，服务端校验并**扣减库存** |
| PUT | `/api/v1/waybills/:id/status` | 改运单状态（改为「已取消」时**回补库存**） |
| GET/POST | `/api/v1/orders`、`/orders/stats` | 订单列表/统计/下单 |
| PUT | `/api/v1/orders/:id/status` | 改订单状态 |

统一响应壳 `{ code, message, data }`，`code !== 0` 为业务错误（如库存不足 `2003`）。
除登录外所有接口需要 `Authorization: Bearer <token>`。

### 页面

- `/login` 登录
- `/inventory` 库存查询（SKU / 仓库 / 安全库存预警）
- `/waybills` 运单管理（建运单扣库存、改状态、取消回补）
- `/orders` 订单管理（下单、改状态）

## 目录

```
server/server.js     本地后端（零依赖）
src/api              API 层（页面只依赖这里）
src/lib/request.ts   请求封装：Mock / 真实后端一键切换、Token 注入
src/mock             Mock 数据层（VITE_USE_MOCK=true 时生效）
src/pages            页面
src/types            类型定义
```
