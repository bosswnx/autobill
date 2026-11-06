# TagLedger — for agents

Repo conventions. Read this before changing code. If it conflicts with `README.md`, these hard rules win.

## What this is

A personal ledger. Flat tags, no category tree, no wallets. One React UI on the browser, Capacitor (iOS + Android), and Tauri (macOS). Sync server is `apps/server`, Linux + SQLite. Do not start a React Native / Flutter app.

The UI is Chinese and English. Language lives in Settings; default is Chinese. The Chinese product name is 标签记账 — never show “TagLedger” in the zh locale. Amounts are integer cents.

## Commands

```bash
npm install
npm run dev              # web http://127.0.0.1:5173/
npm run dev:lan          # bind Vite to LAN for device live reload
npm run build            # build web
npm run server           # sync server (tsx watch); serves the web app if dist exists
npm run server:start     # sync server (no watch)
npm run mcp              # stdio bridge to a running server's /mcp
npm run mcp:token        # exchange target key + user token for an MCP token
npm run serve            # build web, then start API + web on one port
npm run ios              # build + cap sync ios + open Xcode
npm run ios:live         # device against this machine's Vite
npm run android          # build + cap sync android + open Android Studio
npm run android:live     # device against this machine's Vite
npm run macos            # Tauri window against Vite (needs Rust)
npm run macos:build      # .app + dmg
```

`@tagledger/shared` does not need its own build. Vite aliases it to `packages/shared/src/index.ts`; the server imports it with tsx.

## Layout

- `apps/web`: UI, Dexie, sync client, Capacitor iOS/Android, Tauri macOS
- `apps/server`: Hono sync server, and the MCP endpoint in `src/mcp`
- `packages/shared`: types, LWW, token length constants

## Hard rules

### User data

- The local ledger is user data. Schema changes go through Dexie `version` + `upgrade`. Do not `indexedDB.deleteDatabase('tagledger')` unless the user explicitly asks to wipe.
- All writes go through `apps/web/src/db/mutations.ts`. Keep `rev`, soft delete, and `changes` in lockstep. Do not `db.tags.put` around that path.
- New changes must have `seq: null`. The server assigns seq when it acks.
- Do not run the `seedIfNeeded` sample book when sync is already connected.

### Money and time

- Amounts are cents. Display with `formatYuan`. Inputs use `centsToYuanInput` / `yuanToCents`; do not put commas into the input state.
- Slice day / month / year with local `Date` (`dayKey` / `monthKey` / `inMonth`). Do not use `getUTC*`.

### UI

- Overlay mounts on `document.body`, animates in/out, and must close on the system back gesture. New sheets use the existing `Overlay`.
- Phone layout: bottom bar. Desktop layout: sidebar. A tablet (shortest CSS side ≥ 600px) uses phone layout in portrait and desktop layout in landscape. Phones stay on the bottom bar even in landscape. Tauri is always desktop. Do not build a second iPad UI.
- Creating a tag defaults to `kind: 'expense'`. From new-entry or the tags screen you must pass the current type.
- `updateTag` cannot change `kind`.
- Transfer `type: 'transfer'` exists in types but has no UI. Treat it as 0.
- Charts are hand-rolled SVG/CSS. Lines use `preserveAspectRatio="none"`. Dots, dashes, and amounts are HTML overlays so they are not stretched.

### Sync

- One server, many spaces. Gate is three fields: server URL, `TAGLEDGER_TARGET_KEY`, user-chosen token.
- The user token is hashed into `space_key` (HMAC-SHA256 + pepper). The server never stores the plaintext token.
- After connect, call `/v1/sync` with the device token only. The old dual-token pair is gone; do not bring it back.
- A hosted browser (page served from the API origin) with no device token must show the login page first: target key + user token. Do not seed the sample book in that case. Native / Vite / Tauri stay optional-connect in Settings.
- Conflicts: `incomingWins` (`updatedAt`, then `rev`). The server must not overwrite the client's `updatedAt` with receive time.
- If both sides have data, the user must pick `local` / `cloud` / `both`. Do not auto-merge.
- Do not auto-merge tags that share a name.
- Never log or commit user tokens or the target key. `apps/server/data/`, `.env`, and `*.sqlite` are gitignored.
- When applying a remote change, persist its `seq`. Do not append it as a new local change (that echoes).

### Dexie

Current version is v3 (`changes.seq` + `meta`). Further schema changes need a new version and an upgrade.

### MCP

- Tools live in `apps/server/src/mcp/tools.ts`; ledger reads and writes in `store.ts`.
- Every MCP write goes through `store.write`, which appends a `changes` row with a new `rev`, a non-decreasing `updatedAt`, and a server-assigned `seq`. Never `UPDATE entities` directly — that would skip the log and other devices would never see it.
- `/mcp` authenticates a device token only. Target key and user token are accepted at `POST /v1/mcp/token` and nowhere else.
- MCP reads come from the materialized `entities` table; filter `deleted_at`.
- Tool names are snake_case, amounts are integer cents (`amountCents`) with an optional `amountYuan`.
- MCP never creates or deletes tags implicitly: only `create_tag` and `delete_tag` touch tags. Any other tool that receives an unknown tag id or name fails and must be preceded by `create_tag`.
- There is no cloud-wide wipe tool: the wipe button stays local, and a device sync replaces the cloud.

### Git commit

Commit messages follow Conventional Commits: `type(scope): summary`.

- `type`: `feat` / `fix` / `docs` / `refactor` / `chore` / `test` / `style`
- `scope` is a short name: `web`, `server`, `shared`, `ios`, `macos`, `sync`
- Summary is present tense, one short line, what or why — not a vague "update"

```
feat(sync): add connect flow with target key
fix(web): keep overlay back gesture on iOS
docs: describe Dexie v3 meta table
```

Do not write multi-paragraph prose commits. Do not commit unless the user asked.

## Product bounds

- One book. No book switcher.
- No accounts/wallets, category tree, or email login.
- Android is wired (Capacitor). Play listing, signing, and privacy manifests are out of scope.
- Windows and Linux desktop shells are not wired.
- Sync is not end-to-end encrypted (self-hosted server + TLS).
