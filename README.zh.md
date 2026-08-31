# TagLedger

基于标签的个人账本。扁平标签，没有分类树，也没有钱包。一本书、一笔可改的**存款**。

**目标平台：浏览器、iPhone、iPad、macOS、Android。** 同一套 React UI，不按端各写一份。浏览器、iOS（iPhone / iPad）、Android（手机 / 平板）和 macOS（Tauri）已经接上。跨设备同步走自建 Linux 服务：每台设备和服务器都保存全量记录，用追加变更对账。

界面是中文。金额内部用**分**（`amountCents`），展示时用 `formatYuan`：整数不带小数，有余数才显示；整数部分每三位加逗号。

[English](README.md)

## 技术栈

- npm workspaces：`apps/web`、`apps/server`、`packages/shared`
- 前端：React 19 + Vite + TypeScript + Tailwind CSS v4
- 本地库：Dexie（IndexedDB）+ `dexie-react-hooks`
- 同步服务：Hono + SQLite（`better-sqlite3`），可部署在 Linux
- 原生壳：Capacitor（iOS + Android）和 Tauri（macOS）
- 图标：Lucide

共享类型在 `@tagledger/shared`。Vite 和同步服务都直接吃源码，改类型不用先 build。

## 目录

```
apps/web/                 前端 + Capacitor + Tauri 壳
  src/App.tsx             导航：流水 / 统计 / 标签 / 设置 + 记一笔
  src/screens/            LedgerScreen、StatsScreen、TagsScreen、EntrySheet、SettingsScreen、LoginScreen
  src/components/         图表、标签、金额键盘、Overlay、月份/年份切换
  src/db/                 Dexie、mutations、首次 seed
  src/sync/               同步引擎：连接、推拉、冲突三选一
  src/hooks/useLedger.ts  活查询
  src/lib/                金额、时间、标签筛选、统计计算、键盘、布局
  capacitor.config.ts     iOS / Android 壳配置
  ios/                    Xcode 工程（iPhone / iPad）
  android/                Android Studio 工程（手机 / 平板）
  src-tauri/              Tauri macOS 壳
apps/server/              同步服务（Linux）
  src/index.ts            HTTP：/healthz、/v1/connect、/v1/sync、/v1/replace
  src/db.ts               SQLite 日志与物化实体
  .env.example            环境变量样例
packages/shared/src/      Book / Tag / Entry / Change 等类型与 LWW
```

## 运行

```bash
npm install
npm run dev
```

开发地址：`http://127.0.0.1:5173/`。

```bash
npm run build
```

先编 web。shared 由 Vite alias 直接吃源码。

### 同步服务

```bash
npm run serve
```

先编 web，再在同一个端口上同时跑 API 和网页（默认 `http://0.0.0.0:8787`）。新浏览器第一次打开这个地址会先看到登录页（服务器密钥 + 用户 token）。手机 App、Mac 应用和本地 Vite 仍从设置里按服务器地址连接。

只跑 API、不编网页：`npm run server`。已经编过、只想启动：`npm run server:start`（有 `apps/web/dist` 就会托管网页）。

默认 `http://0.0.0.0:8787`。第一次若没设环境变量，会在 `apps/server/data/secrets.json` 生成 **target key** 并打印到终端。`data/` 和 `.env` 不进 git。

正式部署用环境变量（见 `apps/server/.env.example`）：

| 变量 | 作用 |
| --- | --- |
| `TAGLEDGER_TARGET_KEY` | 这台服务器的门禁，所有用户共用 |
| `TAGLEDGER_PEPPER` | 用户 token 哈希用，不要给客户端 |
| `PORT` / `HOST` | 默认 `8787` / `0.0.0.0` |
| `TAGLEDGER_DATA` | SQLite 和 secrets 目录 |
| `TAGLEDGER_WEB` | 可选，网页 `dist` 目录 |

前面用 Caddy / nginx 终止 TLS。打开服务器上的网页时先登录：填服务器密钥和用户 token，不用填地址。

从别的设备连上仍需要三样：

1. 服务器地址
2. Target key
3. 你自己设的用户 token（至少 8 位）

**直接打开这台服务器上的网页**会先登录（不用填地址）。同一台服务器上，用户 token 就是你的空间。不要和别人重复。连上之后同步走设备 token，不再传 target key 和用户 token。

两边都有数据时会停下来让你选：用本机覆盖云端、用云端覆盖本机、两边都留。

### iPhone / iPad（可安装的 App）

同一套 React UI，Capacitor 打进 WKWebView。需要本机有 Xcode，以及一台签过名的 iPhone，或模拟器。Xcode → Settings → Components 里要装好对应的 iOS 平台，否则编不过。

第一次或改完前端之后：

```bash
npm run ios
```

会 `build` → `cap sync ios` → 打开 Xcode。在 Xcode 里：

1. 顶部选中你的 iPhone（用线连上，或选模拟器）
2. Signing & Capabilities 里勾 Automatic Signing，选你的 Apple ID Team
3. 点 Run。真机第一次会提示「不受信任的开发者」，到系统设置 → 通用 → VPN 与设备管理里信任

之后只改了 Web：

```bash
npm run build
npm run cap:sync -w @tagledger/web
```

再回 Xcode 点 Run。不必每次 `cap open`。

真机对着局域网热重载（改代码立刻刷新，不必反复 sync）：

```bash
# 终端 1：Vite 绑到局域网
npm run dev:lan

# 终端 2：把壳指到这台电脑的 IP，再打开 Xcode
npm run ios:live
```

手机和电脑要在同一 Wi-Fi。`ios:live` 会写 `CAP_SERVER_URL` 进 Capacitor 配置；打正式包前用普通的 `npm run ios`，不要带 live URL。

Bundle ID 是 `app.tagledger`。上架、隐私清单、证书还没做，现在只覆盖本机安装。

### Android（可安装的 App）

同一套 React UI，Capacitor 打进 WebView。需要 [Android Studio](https://developer.android.com/studio)，以及模拟器或打开了 USB 调试的手机/平板。

第一次或改完前端之后：

```bash
npm run android
```

会 `build` → `cap sync android` → 打开 Android Studio。再 Run 到设备或模拟器。

之后只改了 Web：

```bash
npm run build
npm run cap:sync -w @tagledger/web
```

再回 Android Studio 点 Run。

真机对着局域网热重载：

```bash
# 终端 1：Vite 绑到局域网
npm run dev:lan

# 终端 2：把壳指到这台电脑的 IP，再打开 Android Studio
npm run android:live
```

手机和电脑要在同一 Wi-Fi。`android:live` 会写 `CAP_SERVER_URL` 进 Capacitor 配置；打正式包前用普通的 `npm run android`，不要带 live URL。

应用 ID 是 `app.tagledger`。上架、签名、隐私清单还没做，现在只覆盖本机安装。

### macOS（可安装的 App）

同一套 React UI，Tauri 打进 WKWebView。这是又一台本地优先的设备：账本在这台 Mac 的 Dexie 里，再从设置里连接同步（服务器地址、服务器密钥、用户 token）。不会走托管网页那套登录页。

需要本机有 [Rust](https://rustup.rs/)（`rustc` 在 PATH 里）和 Xcode。第一次编译会比较慢。

```bash
npm run macos
```

会打开桌面窗口，前端走 Vite `http://127.0.0.1:1420`（和 `npm run dev` 的 5173 分开）。

打 `TagLedger.app` 和 dmg：

```bash
npm run macos:build
```

产物在 `apps/web/src-tauri/target/release/bundle/`。公证和 Developer ID 签名还没做。

Windows / Linux 壳还没接。

## 数据模型

实体都带 `id / rev / createdAt / updatedAt / deletedAt`，删除是软删。写操作走 `mutations.ts`，并往 `changes` 表追加一条。设备 id 存在 `localStorage`（`tagledger.deviceId`）。

| 表 | 作用 |
| --- | --- |
| `books` | 账本。`openingBalanceCents` 是期初，用来反推当前存款 |
| `tags` | 标签。`kind` 只能是 `expense` 或 `income` |
| `entries` | 流水。`type` 为支出/收入；`tagIds` 多对多 |
| `accounts` | 预留，界面未用 |
| `changes` | 变更日志。未上传时 `seq` 为空，服务端确认后写入序号 |
| `meta` | 同步会话：服务器地址、设备 token、cursor |

IndexedDB 库名：`tagledger`。

**存款**不是单独存一个余额。用户填「现在有多少」时，会写成：

`openingBalanceCents = 当前存款 − 全部流水净额`

之后记账自动加减。当前存款 = 期初 + 收入 − 支出。

金额一律用整数分，避免浮点。

## 同步

每台设备和服务器都是完整副本。本地写入先改实体、再追加 `changes`；上线后 `POST /v1/sync` 一轮完成推+拉。服务端给每条首次见到的 change 发全局单调 `seq`，客户端 cursor 是已吃到的最大 seq。

冲突按整实体 **LWW**：同一 `entityId` 比 `updatedAt`，相同再比 `rev`。`rev` 只是本机代数，不当全局时钟。

- 一个空间一本账。
- 已连接的设备不再写入示例 seed。
- 同名标签不自动合并（两台都新建「餐饮」会得到两个 id）。
- 存款随账本实体 LWW；对完账后数字可能变，不对就再设一次。

接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/healthz` | 探活 |
| `POST` | `/v1/connect` | 地址已在客户端；body 带 target key、用户 token、设备信息 → 设备 token |
| `POST` | `/v1/sync` | `Authorization: Bearer <deviceToken>`，推未确认的 change，拉 `seq > cursor` |
| `POST` | `/v1/replace` | 用本机覆盖云端时，先清空该空间日志再推 |

## 页面

**流水**  
按月看账。顶部：支出、收入、结余、存款（只看、不改）。可按详细信息搜索，可按标签筛选。

**记一笔 / 改一笔**  
支出和收入各用一套标签，只展示、只可选当前类型。切换类型会丢掉另一类已选标签。搜索框回车可按当前类型新建标签。金额是自定义键盘（数字、小数点、加减乘除、等号、清零）。详细信息空着时，标题用「用得最多的已选标签」，否则是支出/收入。

**标签**  
支出、收入分两块，各自添加。同名标签可以在两类各有一条。唯一约束是 `bookId + name + kind`。

**统计**  
月 / 年切换。月视图：每天支出/收入柱状图、资产折线、标签金额条。年视图把「天」换成「月」。顶栏：总支出、总收入、结余、总资产、日均或月均。资产线标收尾、最高、最低；最高最低有虚线和对应刻度。

**登录（打开服务器上的网页）**  
新浏览器第一次访问：服务器密钥 + 用户 token，通过后进入账本。之后靠 IndexedDB 里的设备 token，不用每次填。

**设置**  
改存款。连接/断开同步（手机 App、Mac 应用和本地 Vite）、立即同步、两边都有数据时的三选一。

## 标签筛选（流水）

- 同一行（支出内部，或收入内部）：**交集**，选中的标签都要命中。
- 两行之间：**并集**，支出条件或收入条件对上即可。
- 某一行一个都没选，这一行不参与。

实现：`entryMatchesTagFilter`（`apps/web/src/lib/tags.ts`）。

一笔账挂多个标签时，统计里每个标签都记**整笔金额**（不拆分）。只把 `entry.type` 和 `tag.kind` 一致的算进去。

## 时间

日期、月份、图表横轴都按**本地时区**，不要用 UTC 的 `getUTC*` 去切「天」。`dayKey` / `monthKey` / `inMonth` 都走本地 `Date`。

当前月的日均按「本月已过天数」除；当年的月均按「今年已过月数」除。未来月/年除数为 0，均值为 0。

## Dexie 版本

- v1：初始表。
- v2：`tags` 增加 `kind` 索引。升级时按该标签在收入/支出流水上的使用次数归类：收入笔数更多 → `income`，否则 `expense`。未用过的默认支出。
- v3：`changes` 增加 `seq`；新增 `meta` 存同步会话。

再改 schema 必须加新 `version`，并写 `upgrade`。**不要清用户的 IndexedDB 来「修好」迁移。**

## 跨端

| 端 | 状态 | 怎么出 |
| --- | --- | --- |
| 浏览器 | 已有 | `npm run dev` / `npm run build` |
| iPhone | 已接 | `npm run ios`，Xcode 装到真机或模拟器 |
| iPad | 已接 | 同一个 iOS 工程；竖屏走底栏，横屏走侧栏 |
| Android | 已接 | `npm run android`，Android Studio 装到真机或模拟器。平板同样竖屏底栏、横屏侧栏 |
| 同步服务 | 已接 | `npm run server`，Linux + SQLite |

不要另起 React Native / Flutter。共享层在 `@tagledger/shared`；业务和界面继续留在 `apps/web`。原生壳只负责窗口、安全区、以后可能的推送和文件备份。

布局已经分了两套壳，接原生时沿用，不要为平板再开一套页面：

- 手机布局（手机、平板竖屏、窄浏览器）：底栏（流水 / 统计 / 记一笔 / 标签 / 设置）
- 桌面布局（平板横屏、桌面浏览器、Tauri）：左侧栏

接 Capacitor / 真机时注意：

- 预留安全区（刘海、Home Indicator、状态栏），底栏和全屏 Overlay 都要避开。
- 金额键盘、记一笔是自定义键盘，不要让系统键盘把布局顶飞；输入框该 `readOnly` / `inputMode` 的保持现状。
- IndexedDB 在 iOS WKWebView 可用，但 WebView 被系统清缓存时数据可能丢。同步连上后，清掉本地只要再填那三样就能拉回。
- `localStorage` 的 `deviceId` 同样会随 WebView 数据一起没。同步身份以设备 token 为准；丢了重新连接即可。
- 交互按触摸来：不要依赖 hover 才能看见的操作。图表 hover 金额在触屏上要有点按等价物。
- 日期按**设备本地时区**，同一笔 `occurredAt` 在旅行跨时区时不要用 UTC 重切「天」。
- iOS / Android 的返回手势、系统返回键要能关掉 Overlay，不能只靠点遮罩。
- 打包后没有 Vite 开发服务器。`seedIfNeeded` 只在「未连接同步、且一本账都没有」时写入示例。
- App Store / Play 上架、签名、隐私清单还没做。

## 产品边界（当前）

- 只有一本书，不做多账本切换。
- 不做账户/钱包、不做分类树、不做邮箱登录。同步用 target key + 用户 token。
- 可安装的 iOS 包已经接上（`npm run ios`）。可安装的 Android 包已经接上（`npm run android`）。日常改界面仍可先用浏览器。
