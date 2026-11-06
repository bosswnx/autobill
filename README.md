# TagLedger

A tag-based personal ledger. Flat tags, no category tree, no wallets. One book, and one editable **savings** figure.

**Targets: browser, iPhone, iPad, macOS, Android.** One React UI, not a separate app per platform. Browser, iOS (iPhone / iPad), Android (phone / tablet), and macOS (Tauri) are working. Cross-device sync is a self-hosted Linux service: every device and the server keep a full copy and reconcile by appending changes.

The UI is Chinese. Amounts are stored as **cents** (`amountCents`). Display uses `formatYuan`: no decimal when the value is a whole yuan; otherwise show the remainder. Integer groups of three get commas.

[中文](README.zh.md)

## Stack

- npm workspaces: `apps/web`, `apps/server`, `packages/shared`
- Client: React 19 + Vite + TypeScript + Tailwind CSS v4
- Local store: Dexie (IndexedDB) + `dexie-react-hooks`
- Sync server: Hono + SQLite (`better-sqlite3`), deployable on Linux
- Native shell: Capacitor (iOS + Android) and Tauri (macOS)
- Icons: Lucide

Shared types live in `@tagledger/shared`. Vite and the sync server import the source directly; you do not need to build the package first.

## Layout

```
apps/web/                 Web app + Capacitor + Tauri shells
  src/App.tsx             Nav: ledger / stats / tags / settings + new entry
  src/screens/            LedgerScreen, StatsScreen, TagsScreen, EntrySheet, SettingsScreen, LoginScreen
  src/components/         Charts, tags, amount keypad, Overlay, month/year pagers
  src/db/                 Dexie, mutations, first-run seed
  src/sync/               Sync engine: connect, push/pull, three-way merge
  src/hooks/useLedger.ts  Live queries
  src/lib/                Money, time, tag filters, stats, keypad, layout
  capacitor.config.ts    iOS / Android shell config
  ios/                    Xcode project (iPhone / iPad)
  android/                Android Studio project (phone / tablet)
  src-tauri/              Tauri macOS shell
apps/server/              Sync server (Linux)
  src/index.ts            HTTP: /healthz, /v1/connect, /v1/sync, /v1/replace, /v1/mcp/token
  src/mcp/                MCP: tools, ledger reads/writes, stats, stdio bridge
  src/db.ts               SQLite log and materialized entities
  .env.example            Environment sample
packages/shared/src/     Book / Tag / Entry / Change types and LWW
```

## Run

```bash
npm install
npm run dev
```

Dev URL: `http://127.0.0.1:5173/`.

```bash
npm run build
```

Builds web. Shared is consumed from source via the Vite alias.

### Sync server

```bash
npm run serve
```

Builds the web app, then starts the API **and** the same UI on one port (`http://0.0.0.0:8787`). A new browser hitting that URL sees a login page (server key + user token) before the ledger. Phone apps, the Mac app, and other Vite/local clients still connect from Settings, by URL.

Dev-only API (no web build): `npm run server`. Production without rebuilding: `npm run server:start` (serves `apps/web/dist` if it exists).

Listens on `http://0.0.0.0:8787` by default. If env vars are unset on first start, a **target key** is generated in `apps/server/data/secrets.json` and printed to the terminal. `data/` and `.env` are gitignored.

For a real deploy, set env vars (see `apps/server/.env.example`):

| Variable | Role |
| --- | --- |
| `TAGLEDGER_TARGET_KEY` | Server gate, shared by every user on this instance |
| `TAGLEDGER_PEPPER` | Used to hash user tokens; never send to clients |
| `PORT` / `HOST` | Defaults `8787` / `0.0.0.0` |
| `TAGLEDGER_DATA` | Directory for SQLite and secrets |
| `TAGLEDGER_WEB` | Optional path to the web `dist` folder |

Terminate TLS with Caddy or nginx. A hosted browser asks for the target key and user token on a login page; the server URL is this page. After that, this browser is a terminal.

Connecting from another device still needs three things:

1. Server URL
2. Target key
3. A user token you choose (at least 8 characters)

Opening the page **on the server itself** shows login first (no URL field). On a given server, the user token *is* the space. Do not share it. After connect, sync uses a device token; the target key and user token are not sent again.

If both sides already have data, the app stops and asks: overwrite cloud with this device, overwrite this device with cloud, or keep both.

### Docker

```bash
cp apps/server/.env.example .env   # at least TAGLEDGER_TARGET_KEY and TAGLEDGER_PEPPER
docker compose up -d --build
```

The image builds the web app. The container listens on `127.0.0.1:8787` only; put Caddy or nginx in front for TLS. SQLite lives in `./data`.

### MCP (AI agents)

The sync server exposes an MCP endpoint, so an agent can add entries, edit them, manage tags and subscriptions — the same operations the UI offers. Writes go through the same change log, so every device sees them on its next sync.

- Endpoint: `POST /mcp` (Streamable HTTP, stateless, JSON responses)
- Auth: `Authorization: Bearer <MCP token>`
- Exchange the server gate for an MCP token:

```bash
TAGLEDGER_MCP_URL=https://ledger.example.com \
TAGLEDGER_TARGET_KEY=... \
TAGLEDGER_USER_TOKEN=... \
npm run mcp:token
```

Minting again with the same `deviceName` rotates that agent's token; different names (Claude Code, Claude Desktop, …) keep separate tokens.

HTTP-capable clients connect directly:

```json
{
  "mcpServers": {
    "tagledger": {
      "type": "http",
      "url": "https://ledger.example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

stdio-only clients use the bundled bridge:

```bash
TAGLEDGER_MCP_URL=https://ledger.example.com \
TAGLEDGER_MCP_TOKEN=<token> \
npm run mcp
```

Without a token, set `TAGLEDGER_TARGET_KEY` + `TAGLEDGER_USER_TOKEN` instead and the bridge mints one on start.

Tools: `ledger_info`, `set_savings`, `list_tags`, `create_tag`, `update_tag`, `delete_tag`, `list_entries`, `get_entry`, `create_entry`, `update_entry`, `delete_entry`, `ledger_stats`, `list_subscriptions`, `create_subscription`, `update_subscription`, `delete_subscription`.

Conventions: amounts are integer cents (or `amountYuan`); times are ISO 8601 or local `YYYY-MM-DD HH:mm`; "this month" follows the server time zone reported by `ledger_info`. Tags are created and deleted only by `create_tag` / `delete_tag`; any other tool that receives an unknown tag id or name fails, so create the tag first. Due subscription entries are still materialized by the app when it opens — the server does not create them. There is no cloud-wide wipe tool — the wipe button in Settings is local, and the cloud is replaced by a device sync.

### iPhone / iPad (installable app)

The same React UI is wrapped in WKWebView by Capacitor. You need Xcode, plus a signed iPhone or a simulator. Install the matching iOS platform under Xcode → Settings → Components or the build will fail.

First time, or after changing the web app:

```bash
npm run ios
```

This runs `build` → `cap sync ios` → opens Xcode. Then:

1. Pick your iPhone (cable or simulator) in the toolbar
2. Signing & Capabilities → Automatic Signing, pick your Apple ID team
3. Run. The first device install will say the developer is untrusted; trust it under Settings → General → VPN & Device Management

After web-only changes:

```bash
npm run build
npm run cap:sync -w @tagledger/web
```

Then Run in Xcode. You do not need `cap open` every time.

Live reload on a physical device against your LAN:

```bash
# Terminal 1: bind Vite to the LAN
npm run dev:lan

# Terminal 2: point the shell at this machine's IP, then open Xcode
npm run ios:live
```

Phone and computer must be on the same Wi-Fi. `ios:live` writes `CAP_SERVER_URL` into the Capacitor config. For a store/dev IPA use plain `npm run ios` with no live URL.

Bundle ID is `app.tagledger`. App Store, privacy manifests, and certificates are not in this repo yet. Local install only.

### Android (installable app)

The same React UI is wrapped in a WebView by Capacitor. You need [Android Studio](https://developer.android.com/studio) and an emulator or a USB-debuggable phone/tablet.

First time, or after changing the web app:

```bash
npm run android
```

This runs `build` → `cap sync android` → opens Android Studio. Then Run on a device or emulator.

After web-only changes:

```bash
npm run build
npm run cap:sync -w @tagledger/web
```

Then Run in Android Studio.

Live reload on a physical device against your LAN:

```bash
# Terminal 1: bind Vite to the LAN
npm run dev:lan

# Terminal 2: point the shell at this machine's IP, then open Android Studio
npm run android:live
```

Phone and computer must be on the same Wi-Fi. `android:live` writes `CAP_SERVER_URL` into the Capacitor config. For a store/dev APK use plain `npm run android` with no live URL.

Application ID is `app.tagledger`. Play listing, signing, and privacy manifests are not in this repo yet. Local install only.

### macOS (installable app)

The same React UI is wrapped in WKWebView by Tauri. This is another local-first device: Dexie on this Mac, then connect from Settings (server URL, server key, user token). It does not open the hosted login page.

Needs [Rust](https://rustup.rs/) (`rustc` on PATH) and Xcode. First compile is slow.

```bash
npm run macos
```

Opens a desktop window against Vite on `http://127.0.0.1:1420` (separate from `npm run dev` on 5173).

To produce `TagLedger.app` and a dmg:

```bash
npm run macos:build
```

Output is under `apps/web/src-tauri/target/release/bundle/`. Notarization and Developer ID signing are not in this repo yet.

Windows and Linux shells are not wired.

## Data model

Every entity has `id / rev / createdAt / updatedAt / deletedAt`. Deletes are soft. Writes go through `mutations.ts` and append a row to `changes`. Device id is in `localStorage` (`tagledger.deviceId`).

| Table | Role |
| --- | --- |
| `books` | Ledger. `openingBalanceCents` is the opening figure used to recover current savings |
| `tags` | Tags. `kind` is `expense` or `income` only |
| `entries` | Transactions. `type` is expense/income; `tagIds` is many-to-many |
| `accounts` | Reserved, unused in the UI |
| `changes` | Change log. `seq` is empty until the server acks it |
| `meta` | Sync session: server URL, device token, cursor |

IndexedDB name: `tagledger`.

**Savings** is not stored as a running balance. When the user types “how much I have now”:

`openingBalanceCents = current savings − net of all entries`

Later entries add and subtract automatically. Current savings = opening + income − expense.

Always integer cents. No floats.

## Sync

Every device and the server is a full replica. A local write updates the entity, then appends `changes`. When online, one `POST /v1/sync` pushes and pulls. The server assigns a global monotonic `seq` to each change it sees for the first time. The client cursor is the highest `seq` it has applied.

Conflicts are whole-entity **LWW**: same `entityId` compares `updatedAt`, then `rev`. `rev` is a local generation count, not a global clock.

- One space, one book.
- A connected device must not write the sample seed.
- Duplicate tag names are not auto-merged (two devices creating “餐饮” get two ids).
- Savings follows LWW on the book entity. After a merge the displayed number may change; set savings again if it looks wrong.

API:

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/healthz` | Health |
| `POST` | `/v1/connect` | Body: target key, user token, device info → device token |
| `POST` | `/v1/sync` | `Authorization: Bearer <deviceToken>`; push unacked changes, pull `seq > cursor` |
| `POST` | `/v1/replace` | When overwriting cloud with local: wipe that space’s log, then push |
| `POST` | `/v1/mcp/token` | Exchange target key + user token for an MCP token |
| `POST` | `/mcp` | MCP Streamable HTTP, `Authorization: Bearer <MCP token>` |

## Screens

**Ledger**  
Month view. Header: expense, income, net, savings (read-only). Search notes; filter by tags.

**New / edit entry**  
Expense and income each have their own tag set; only the current type is shown and selectable. Switching type drops tags of the other kind. Enter in the search box creates a tag of the current type. Amount uses a custom keypad (digits, decimal, + − × ÷, equals, clear). If the note is empty, the title is the most-used selected tag; otherwise “expense” or “income”.

**Tags**  
Expense and income blocks, each with its own add. The same name may exist once per kind. Uniqueness is `bookId + name + kind`.

**Stats**  
Month / year. Month: daily expense/income bars, asset line, tag amount bars. Year swaps days for months. Header: total expense, total income, net, total assets, daily or monthly average. The asset line marks last, high, and low; high/low have dashed guides and ticks.

**Login (hosted server)**  
First visit from a new browser: server key + user token, then the ledger. Later visits reuse the device token in IndexedDB.

**Settings**  
Set current savings. Connect / disconnect sync (native, Mac, and local Vite), sync now, and the three-way choice when both sides have data.

## Tag filter (ledger)

- Same row (within expense, or within income): **intersection** — every selected tag must match.
- Across the two rows: **union** — expense condition or income condition.
- An empty row does not participate.

Implemented by `entryMatchesTagFilter` (`apps/web/src/lib/tags.ts`).

If an entry has several tags, stats attribute the **full amount** to each tag (no split). Only pairs where `entry.type` matches `tag.kind` count.

## Time

Dates, months, and chart axes use the **device local timezone**. Do not slice “days” with UTC `getUTC*`. `dayKey` / `monthKey` / `inMonth` all use local `Date`.

Daily average for a month divides by that month’s total days. Monthly average for the current year divides by elapsed months. Future years have divisor 0, so the average is 0.

## Dexie versions

- v1: initial stores.
- v2: `kind` index on `tags`. Upgrade classifies by how often the tag appears on income vs expense entries: more income → `income`, otherwise `expense`. Unused tags default to expense.
- v3: `seq` on `changes`; `meta` for the sync session.

Schema changes need a new `version` and an `upgrade`. **Do not wipe the user’s IndexedDB to “fix” a migration.**

## Platforms

| Surface | Status | How |
| --- | --- | --- |
| Browser | Ready | `npm run dev` / `npm run build` |
| iPhone | Wired | `npm run ios`, Xcode to device or simulator |
| iPad | Wired | Same iOS project; portrait uses the bottom bar, landscape uses the sidebar |
| Android | Wired | `npm run android`, Android Studio to device or emulator. Same portrait / landscape split on tablets |
| Sync server | Wired | `npm run server`, Linux + SQLite |

Do not start a React Native / Flutter app. Shared types stay in `@tagledger/shared`; product and UI stay in `apps/web`. The native shell owns the window, safe areas, and later maybe push and file backup.

Layout is already split into two shells. Reuse it when wrapping native; do not build a second tablet UI:

- Phone layout (phones, tablet portrait, narrow browser): bottom bar (ledger / stats / new entry / tags / settings)
- Desktop layout (tablet landscape, desktop browser, Tauri): left sidebar

Capacitor / device notes:

- Respect safe areas (notch, Home Indicator, status bar). Bottom bar and full-screen overlays must clear them.
- Amount keypad and new-entry are custom; do not let the system keyboard shove the layout. Keep `readOnly` / `inputMode` as they are.
- IndexedDB works in iOS WKWebView, but the system may evict it. After sync is connected, wiping local data is recoverable by entering the three connect fields again.
- `localStorage` `deviceId` dies with WebView data too. Sync identity is the device token; reconnect if it is gone.
- Design for touch. Do not hide actions behind hover. Chart hover amounts need a tap equivalent on touch screens.
- Dates use the **device local timezone**. Do not re-slice a trip’s `occurredAt` with UTC.
- iOS back swipe and Android back must dismiss Overlay; a tap on the dimmer is not enough.
- Packaged builds have no Vite server. `seedIfNeeded` only writes samples when sync is **not** connected and there is no book.
- App Store / Play listing, signing, and privacy manifests are not in this repo.

## Product bounds (now)

- One book. No book switcher.
- No accounts/wallets, no category tree, no email login. Sync is target key + user token.
- Installable iOS via `npm run ios`. Installable Android via `npm run android`. Day-to-day UI work can stay in the browser.
