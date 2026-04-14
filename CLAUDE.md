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

Prism is a **Harness Engineering environment management tool** — it manages the infrastructure that AI agents depend on: Rules, Skills, Agents, MCP Servers, and Hooks, across multiple platforms (Claude Code, CodeBuddy, Cursor, OpenClaw). It is NOT a chat interface or agent runtime.

**Harness Engineering** = the 3-layer framework that makes agents work reliably:
1. Environment Design (CLAUDE.md / Rules / Skills / Agents)
2. Tool Integration (MCP Servers)
3. Feedback Mechanisms (Hooks / evaluators)

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
                         Routes: GET /health, GET /platforms, POST /scan, GET /rules, POST /rules, GET /rules/:id, PUT /rules/:id, DELETE /rules/:id, GET /rules/:id/projections, GET /skills, POST /skills, GET /skills/:id, PUT /skills/:id, DELETE /skills/:id, GET /skills/:id/projections, GET /agents, POST /agents, GET /agents/:id, PUT /agents/:id, DELETE /agents/:id, GET /agents/:id/projections, GET /mcp, POST /mcp, GET /mcp/:id, PUT /mcp/:id, DELETE /mcp/:id, GET /mcp/:id/projections, POST /platforms/:platformId/mcp/import, GET /platforms/:platformId/mcp/scan, GET /profiles, POST /profiles, GET /profiles/:id, PUT /profiles/:id, DELETE /profiles/:id, POST /profiles/:id/publish, GET /revisions, GET /revisions/:id, POST /revisions/:id/rollback
apps/web/             → React + Vite frontend; renders platform scan results.
                         Pages: PlatformScanResult cards (Scanner tab), RulesPage list, RuleEditorPage with Monaco + projection preview (Rules tab), SkillsPage list, SkillEditorPage with Monaco + projection preview (Skills tab), AgentsPage list, AgentEditorPage with Monaco + projection preview (Agents tab), McpPage list + McpEditorPage form editor (MCP tab), ProfilesPage list, ProfileEditorPage with publish flow (Profiles tab), RevisionsPage with rollback UI (Revisions tab)
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

### Version Completion E2E Requirement

**After completing each feature or version, run E2E tests before marking it done.**

Use the `e2e-runner` agent (Playwright) to exercise the affected user flows in a real browser after completing each version's development. Minimum checklist:
- [ ] Run full Playwright E2E suite against the completed features
- [ ] Verify all critical user flows work end-to-end
- [ ] Confirm no regressions in adjacent flows

### Bug Fix E2E Requirement

**After every bug fix, run a browser-level E2E test before marking it done.**

`curl` bypasses CORS and browser fetch mechanics entirely — a fix that works in `curl` may still fail in the actual UI. Use the `e2e-runner` agent (Playwright) to exercise the affected user flow in a real browser.

Minimum E2E checklist per bug fix:
- [ ] Reproduce the original failure path in the browser
- [ ] Confirm the fix resolves it
- [ ] Verify no adjacent flows are broken (e.g., create/edit still work after fixing delete)
