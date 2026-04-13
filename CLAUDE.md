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
                         Routes: GET /health, GET /platforms, POST /scan
apps/web/             → React + Vite frontend; renders platform scan results.
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

## Current State (v0.1 — Scanner PoC ✅)

v0.1 complete: monorepo scaffolding, three platform adapters scan real filesystem, `/platforms` API returns live data, frontend renders scan result cards with capability badges and rescan button.

**Next milestone — v0.2 Rule Editor** (not yet started): UnifiedRule type system, FileRuleStore JSON persistence (`~/.prism/rules/rules.json`), projectRule() per-platform projection, `/rules` CRUD API, Monaco editor frontend with projection preview panel.

After v0.2: Profile PoC (v0.3), then real publish with backup/revision (v0.4 MVP).

Core asset types planned: **Rules** (text with scope/tags/platform overrides) and **Profiles** (Rule collections with target platform bindings). Publish flow must include dry-run preview, diff, backup, and revision history before writing to disk.
