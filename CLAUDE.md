# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start all packages in dev mode (parallel)
pnpm dev

# Start individual services
pnpm --filter @prism/server dev    # Fastify API on :3001 (tsx watch)
pnpm --filter @prism/web dev       # Vite frontend on :5173

# Build all packages (respects Turbo dependency order)
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Run tests
pnpm test
```

API verification:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/platforms
curl -X POST http://localhost:3001/scan
```

## Architecture

Prism is a **local-first AI config control plane** — it scans, manages, and selectively publishes AI tool configurations across multiple platforms (OpenClaw, CodeBuddy, Cursor, Claude Code). It is NOT a chat interface or agent runtime.

### Package Responsibilities

```
packages/shared/      → Pure types: PlatformId, PlatformCapabilities,
                         PlatformScanResult. Zero dependencies.
packages/core/        → PlatformAdapter interface, AdapterRegistry,
                         scanPlatforms() orchestrator. No I/O.
packages/adapters/
  adapter-openclaw/   → Scans ~/.openclaw for platform presence + rules/ subdir
  adapter-codebuddy/  → Scans ~/.codebuddy for platform presence
  adapter-claude-code/→ Scans ~/.claude-internal (falls back to ~/.claude)
packages/server/      → Fastify API; wires adapters → HTTP.
                         Routes: GET /health, GET /platforms, POST /scan, GET /rules, POST /rules, GET /rules/:id, PUT /rules/:id, DELETE /rules/:id, GET /rules/:id/projections, GET /profiles, POST /profiles, GET /profiles/:id, PUT /profiles/:id, DELETE /profiles/:id, POST /profiles/:id/publish, GET /revisions, GET /revisions/:id, POST /revisions/:id/rollback
apps/web/             → React + Vite frontend; renders platform scan results.
                         Pages: PlatformScanResult cards (Scanner tab), RulesPage list, RuleEditorPage with Monaco + projection preview (Rules tab), ProfilesPage list, ProfileEditorPage with publish flow (Profiles tab), RevisionsPage with rollback UI (Revisions tab)
```

### Data Flow

```
Browser → GET /platforms
  → server/src/index.ts
    → registry.scanAll()  (AdapterRegistry from @prism/core)
      → adapter.scan()  (each adapter checks real fs paths)
        → PlatformScanResult[]
  ← { items: PlatformScanResult[] }

Browser → POST /scan
  → server/src/routes/scan.ts
    → registry.scanAll()
  ← { items: PlatformScanResult[], scannedAt: string }
```

### Key Interfaces

`PlatformAdapter` (defined in `packages/core/src/types.ts`):
```ts
interface PlatformAdapter {
  id: PlatformId
  displayName: string
  capabilities: PlatformCapabilities
  scan: () => Promise<PlatformScanResult>
}
```

`PlatformScanResult` (defined in `packages/shared/src/index.ts`):
```ts
interface PlatformScanResult {
  id: PlatformId
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
  rulesDetected?: boolean
}
```

### TypeScript Path Aliases

All cross-package imports use `@prism/*` aliases (configured in `tsconfig.base.json`). All packages extend `tsconfig.base.json`. Module system is `ESNext` with `moduleResolution: Bundler`.

### Known Blocker

CORS: `@fastify/cors` is imported in server but may not be installed. If browser fetches fail while `curl` succeeds, run `cd packages/server && npm install @fastify/cors` as a workaround for the pnpm/Node version incompatibility.

## Development Workflow

### Bug Fix E2E Requirement

**After every bug fix, run a browser-level E2E test before marking it done.**

`curl` bypasses CORS and browser fetch mechanics entirely — a fix that works in `curl` may still fail in the actual UI. Use the `e2e-runner` agent (Playwright) to exercise the affected user flow in a real browser.

Minimum E2E checklist per bug fix:
- [ ] Reproduce the original failure path in the browser
- [ ] Confirm the fix resolves it
- [ ] Verify no adjacent flows are broken (e.g., create/edit still work after fixing delete)

## Current State (v0.5 — Publish Pipeline ✅)

v0.1 complete: monorepo scaffolding, three platform adapters scan real filesystem, `/platforms` API returns live data, frontend renders scan result cards with capability badges and rescan button.

v0.2 complete: UnifiedRule type system, FileRuleStore JSON persistence (`~/.prism/rules/rules.json`), `projectRule()` per-platform projection, `/rules` CRUD API (GET list, GET by id, POST create, PUT update, DELETE), Monaco editor frontend with projection preview panel, tab navigation between Scanner and Rules views.

v0.3 complete: Platform rule scanning — optional `importRules()` on each adapter reads real `.md` files from platform directories.

v0.4 complete: Profile system — `Profile` type (name, description, platformBindings, ruleIds), FileProfileStore JSON persistence (`~/.prism/profiles/profiles.json`), `/profiles` CRUD API, ProfilesPage list + ProfileEditorPage.

v0.5 complete: Publish Pipeline — `PublishEngine` writes rule files to platform config dirs with automatic backup; `FileRevisionStore` persists revision records to `~/.prism/revisions/`; `POST /profiles/:id/publish` API; `GET /revisions` + `GET /revisions/:id` + `POST /revisions/:id/rollback` API; ProfileEditorPage publish flow with dry-run preview and inline confirm; RevisionsPage with inline rollback confirm; Revisions top-level tab in the app shell.

### Key paths added in v0.5
- `packages/core/src/publish/` — PublishEngine, FileRevisionStore, platform-paths
- `packages/server/src/routes/publish.ts` — POST /profiles/:id/publish
- `packages/server/src/routes/revisions.ts` — GET/POST revision routes
- `apps/web/src/api/client.ts` — shared fetch client (request<T>())
- `apps/web/src/api/revisions.ts` — revisionsApi
- `apps/web/src/pages/RevisionsPage.tsx` — revision list + rollback UI

### Server routes (complete list)
GET /health, GET /platforms, POST /scan,
GET /rules, POST /rules, GET /rules/:id, PUT /rules/:id, DELETE /rules/:id, GET /rules/:id/projections,
GET /profiles, POST /profiles, GET /profiles/:id, PUT /profiles/:id, DELETE /profiles/:id, POST /profiles/:id/publish,
GET /revisions, GET /revisions/:id, POST /revisions/:id/rollback
