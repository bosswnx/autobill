# TagLedger — 给助手

这个文件是仓库约定。改代码前先读，和 `README.md` 冲突时以这里的硬性规则为准。

## 这是什么

个人账本。扁平标签，没有分类树，没有钱包。同一套 React UI 跑在浏览器和 Capacitor（iOS）。同步服务在 `apps/server`，Linux + SQLite。不要另起 React Native / Flutter。

界面中文。金额内部是整数分。

## 命令

```bash
npm install
npm run dev              # 前端 http://127.0.0.1:5173/
npm run dev:lan          # 前端绑局域网，给真机 live reload
npm run build            # 编 web
npm run server           # 同步服务（tsx watch）
npm run server:start     # 同步服务（不 watch）
npm run ios              # build + cap sync ios + 打开 Xcode
npm run ios:live         # 真机对着本机 Vite
```

共享包 `@tagledger/shared` 不需要单独 build。Vite alias 到 `packages/shared/src/index.ts`；服务端用 tsx 直接 import。

## 目录

- `apps/web`：UI、Dexie、同步客户端、Capacitor iOS
- `apps/server`：Hono 同步服务
- `packages/shared`：类型、LWW、token 长度常量

## 硬性规则

### 用户数据

- 本地账本是用户数据。改结构走 Dexie `version` + `upgrade`，不要 `indexedDB.deleteDatabase('tagledger')`，除非用户明确要求清空。
- 所有写入走 `apps/web/src/db/mutations.ts`。保持 `rev`、软删、`changes` 一致。不要直接 `db.tags.put` 绕过。
- 新 change 的 `seq` 必须是 `null`，由服务端确认后再写序号。
- 已连接同步时不要跑 `seedIfNeeded` 的示例账。

### 金额和时间

- 金额用分。展示 `formatYuan`；输入用 `centsToYuanInput` / `yuanToCents`，不要把逗号写进输入态。
- 切「天 / 月 / 年」用本地 `Date`（`dayKey` / `monthKey` / `inMonth`），不要 `getUTC*`。

### UI

- Overlay 挂 `document.body`，进出有动画，返回手势要能关掉。新弹层跟现有 `Overlay`。
- 窄屏底栏，`md` 及以上侧栏。不要为 iPad 再开一套页面。
- 标签创建默认 `kind: 'expense'`。从记一笔或标签页添加时必须传入当前类型。
- `updateTag` 不能改 `kind`。
- 转账 `type: 'transfer'` 在类型里有，界面没有入口，当 0 处理。
- 图表是自制 SVG/CSS。折线 `preserveAspectRatio="none"`；圆点、虚线、金额用 HTML 叠，避免被拉扁。

### 同步

- 一台服务器多个空间。进门三样：服务器地址、`TAGLEDGER_TARGET_KEY`、用户自己设的 token。
- 用户 token 哈希后才是 `space_key`（HMAC-SHA256 + pepper）。服务端不存明文 token。
- 连接成功后只拿设备 token 调 `/v1/sync`。A/B 那套双 token 已经废弃，不要加回去。
- 冲突：`incomingWins`（`updatedAt`，相同再 `rev`）。服务端不要用入库时间覆盖客户端的 `updatedAt`。
- 两边都有数据必须让用户选 `local` / `cloud` / `both`，不要自动合。
- 同名标签不自动合并。
- 不要把用户 token、target key 写进日志或 commit。`apps/server/data/`、`.env`、`*.sqlite` 已 gitignore。
- 远端 change 写入本地时带上 `seq`，不要再当新的本地变更追加（否则回声）。

### Dexie

当前到 v3（`changes.seq` + `meta`）。再改必须加新 version 和 upgrade。

## 产品边界

- 一本账，不做多账本切换。
- 不做账户/钱包、分类树、邮箱登录。
- Android 未接。上架、签名、隐私清单不在当前范围。
- 同步不做端到端加密（自建服务器 + TLS）。
