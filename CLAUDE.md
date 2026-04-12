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
```

API verification:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/platforms
```

## Architecture

Prism is a **local-first AI config control plane** — it scans, manages, and selectively publishes AI tool configurations across multiple platforms (OpenClaw, CodeBuddy, Cursor, Claude Code). It is NOT a chat interface or agent runtime.

### Package Responsibilities

```
packages/shared/      → PlatformId, PlatformScanResult, PlatformCapabilities (pure types, no deps)
packages/core/        → PlatformAdapter interface + scanPlatforms() orchestrator
packages/adapters/
  adapter-openclaw/   → Scans ~/.openclaw for platform presence
  adapter-codebuddy/  → Scans ~/.codebuddy for platform presence
  adapter-claude-code/→ Scaffold only, not wired to server yet
packages/server/      → Fastify API; imports adapters directly and calls scanPlatforms()
apps/web/             → React + Vite frontend; fetches /platforms, renders scan results
```

### Data Flow

```
Browser → GET /platforms
  → server/src/index.ts
    → scanPlatforms([openclawAdapter, codebuddyAdapter])  (from @prism/core)
      → adapter.scan()  (each adapter checks fs for config dir)
        → PlatformScanResult[]
  ← { items: PlatformScanResult[] }
```

### Key Interfaces

`PlatformAdapter` (defined in `packages/core`):
```ts
interface PlatformAdapter {
  id: PlatformId
  displayName: string
  scan: () => Promise<PlatformScanResult>
}
```

`PlatformScanResult` (defined in `packages/shared`):
```ts
interface PlatformScanResult {
  id: PlatformId
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: PlatformCapabilities
}
```

### TypeScript Path Aliases

All cross-package imports use `@prism/*` aliases (configured in `tsconfig.base.json`). All packages extend `tsconfig.base.json`. Module system is `ESNext` with `moduleResolution: Bundler`.

### Known Blocker

CORS: `@fastify/cors` is imported in server but may not be installed. If browser fetches fail while `curl` succeeds, run `cd packages/server && npm install @fastify/cors` as a workaround for the pnpm/Node version incompatibility.

## Current State (v0.1 Scanner PoC)

Completed: monorepo scaffolding, both adapters scan real filesystem, `/platforms` API returns live data, frontend renders scan results.

Next milestone (v0.2): Rule data model, Rule editor, projection preview. After that: Profile PoC (v0.3), then real publish with backup/revision (v0.4 MVP).

Core asset types planned: **Rules** (text with scope/tags/platform overrides) and **Profiles** (Rule collections with target platform bindings). Publish flow must include dry-run preview, diff, backup, and revision history before writing to disk.
