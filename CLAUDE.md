# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ezBookkeeping is a lightweight, self-hosted personal finance app. It is a single Go binary that serves both a JSON API and an embedded Vue 3 single-page frontend. One executable does everything via subcommands (`server run`, `database`, `userdata`, `cron`, `secutil`, etc.) — see `ezbookkeeping.go` and `cmd/`.

## Commands

### Backend (Go)
- Build requires **CGO** (`CGO_ENABLED=1`) and **GCC**, because of the `mattn/go-sqlite3` driver.
- Build the binary: `CGO_ENABLED=1 go build -o ezbookkeeping ezbookkeeping.go`
- Run the server: `./ezbookkeeping server run` (listens on `:8080`; config from `conf/ezbookkeeping.ini`, override with `--conf-path`)
- Vet: `go vet ./...`
- Run all tests: `go test ./...`
- Run a single package's tests: `go test ./pkg/services/ -v`
- Run a single test: `go test ./pkg/services/ -run TestName -v`

### Frontend (Vue 3 + TypeScript)
- `npm install` then:
- Dev server with hot reload: `npm run serve` (proxies API calls to a running backend — see `vite.config.ts`)
- Lint + typecheck: `npm run lint` (runs `vue-tsc --noEmit` then `eslint . --fix`)
- Test: `npm run test` (vitest). Single file: `npx vitest run src/lib/__tests__/numeral.test.ts`
- Build: `npm run build` (outputs to `dist/`)

### Full build / packaging
`build.sh` (Linux/macOS), `build.bat` / `build.ps1` (Windows) orchestrate everything: lint → test → build frontend → build backend → package.
- `./build.sh backend|frontend|package|docker`
- `./build.sh package -o ezbookkeeping.tar.gz` produces a full release archive
- Useful flags: `--no-lint`, `--no-test`, `-r`/`--release`. `SKIP_TESTS` env var passes a `-skip` pattern to `go test`.

The frontend builds into `dist/` and is served by the Go server as static files from `static_root_path` (default `public`); the build copies/embeds frontend assets so the final binary is self-contained.

## Backend architecture (`pkg/`)

Layered, with a hand-rolled dependency-injection pattern built on **singletons + container structs**:

- **`pkg/api/`** — HTTP handlers. Each file (e.g. `transactions.go`) declares a package-level singleton (`var Transactions = &TransactionsApi{...}`) wired with `container` references to settings/services/etc. Handlers have signature `func(*core.WebContext) (any, *errs.Error)`.
- **`pkg/services/`** — business logic + persistence. Services embed helper structs from `services/base.go` (`ServiceUsingDB`, `ServiceUsingConfig`, `ServiceUsingStorage`, `ServiceUsingUuid`, `ServiceUsingMailer`) that expose their backing container. Also singletons.
- **`pkg/models/`** — XORM-mapped DB entities + request/response view-objects, with `ToXxxResponse()` conversion methods. Tests live alongside (`*_test.go`).
- **`pkg/datastore/`** — XORM wrapper. `DataStore` holds DB "shards"; `Choose(key)`/`Query(c, key)` select a shard (currently always shard 0, but the sharding seam exists). Use `DoTransaction(key, ctx, fn)` for transactional work.
- **`pkg/core/`** — cross-cutting primitives: `WebContext`/`CliContext`/`CronContext` (all implement `core.Context`), handler func types (`handler.go`), the `errs.Error` flow, plus domain value types (currency, datetime, calendar, fiscal year, coordinate, numeral).
- **`pkg/errs/`** — structured error type returned by all handlers; never return bare `error` from an API handler.
- **`pkg/settings/`** — INI config loading into `settings.Config`, exposed via `settings.Container`.

Other notable packages: `converters/` (per-format import/export: csv, ofx, qif, gnucash, fireflyIII, beancount, camt, mt940, excel, alipay/wechat/jdcom/feidee…), `llm/` + `mcp/` (AI: receipt recognition + Model Context Protocol tool handlers), `cron/`, `exchangerates/`, `storage/` (local + minio/S3), `auth/oauth2/`, `middlewares/`, `validators/`, `locales/`.

### Routing & request flow (`cmd/webserver.go`)
Routes are registered in `cmd/webserver.go`, not in `pkg/api`. Gin handlers are produced by `bind*` adapters (`bindApi`, `bindApiWithTokenUpdate`, `bindMiddleware`, `bindImage`, `bindProxy`, `bindJSONRPCApi`, `bindCachedJs`…) that convert the typed `core.ApiHandlerFunc` into a `gin.HandlerFunc` and serialize the `(any, *errs.Error)` result. Authenticated API lives under `/api/v1/*.json`, guarded by `middlewares.JWTAuthorization` and `middlewares.APITokenIpLimit`. MCP is served at `/mcp` (JSON-RPC), OAuth2 at `/oauth2`.

When adding an endpoint: add the handler method in `pkg/api/<area>.go`, add any service method in `pkg/services/`, define request/response models in `pkg/models/`, then register the route in `cmd/webserver.go`.

## Frontend architecture (`src/`)

Two distinct UIs from one codebase — **mobile** (Framework7) and **desktop** (Vuetify) — chosen at runtime by device type (`src/index-main.ts` redirects to `mobile`/`desktop`). The Vite build has multiple HTML entry points (`desktop.html`, `mobile.html`) — see `rollupOptions.input` in `vite.config.ts`.

- **`src/views/{mobile,desktop}/`** — UI-specific page components. Shared logic for a page lives in **`src/views/base/*PageBase.ts`**, which both the mobile and desktop versions of that page import. Put view logic in the `*PageBase.ts` so it isn't duplicated across the two UIs.
- **`src/components/{base,common,mobile,desktop}/`** — same base/specific split for reusable components.
- **`src/core/`** — framework-agnostic domain types/enums (currency, transaction, category, statistics, datetime…), mirroring backend concepts.
- **`src/lib/`** — business/util functions and the API client layer (`services.ts`, `session.ts`, plus domain helpers). `__tests__/` holds vitest specs.
- **`src/stores/`** — Pinia stores, one per domain (account, transaction, transactionCategory, exchangeRates, statistics, user, setting…).
- **`src/router/`** — `mobile.ts` and `desktop.ts` route tables.
- **`src/locales/`** — i18n message catalogs (vue-i18n). The project supports ~20 languages; translations are coordinated externally (see README "Translating").

Path alias `@` → `src/` (set in both `vite.config.ts` and `vitest.config.ts`).

## Conventions

- Multi-database: code must work across **SQLite, MySQL, PostgreSQL**. Use the XORM session/`datastore` helpers rather than raw SQL strings where possible.
- API handlers return `(any, *errs.Error)` — surface failures as `errs.Error`, not Go `error`.
- Anything user-facing (UI strings, validation messages) is internationalized; don't hardcode display text.
- Keep mobile/desktop logic in shared `*Base` files; only the thin view/component wrappers should differ between the two UIs.

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues (via the `gh` CLI). External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five canonical labels as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
