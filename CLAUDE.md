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
1. 环境设计 (CLAUDE.md / Rules / Skills / Agents)
2. 工具集成 (MCP Servers)
3. 反馈机制 (Hooks / evaluators)

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
                         Routes: GET /health, GET /platforms, POST /scan, GET /rules, POST /rules, GET /rules/:id, PUT /rules/:id, DELETE /rules/:id, GET /rules/:id/projections, GET /skills, POST /skills, GET /skills/:id, PUT /skills/:id, DELETE /skills/:id, GET /skills/:id/projections, GET /agents, POST /agents, GET /agents/:id, PUT /agents/:id, DELETE /agents/:id, GET /agents/:id/projections, GET /profiles, POST /profiles, GET /profiles/:id, PUT /profiles/:id, DELETE /profiles/:id, POST /profiles/:id/publish, GET /revisions, GET /revisions/:id, POST /revisions/:id/rollback
apps/web/             → React + Vite frontend; renders platform scan results.
                         Pages: PlatformScanResult cards (Scanner tab), RulesPage list, RuleEditorPage with Monaco + projection preview (Rules tab), SkillsPage list, SkillEditorPage with Monaco + projection preview (Skills tab), AgentsPage list, AgentEditorPage with Monaco + projection preview (Agents tab), ProfilesPage list, ProfileEditorPage with publish flow (Profiles tab), RevisionsPage with rollback UI (Revisions tab)
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

### Documentation Update Requirement

**每次完成一个版本开发后，必须更新 `docs/ROADMAP.md` 和相关进度文档。**

- 在版本状态表中将已完成版本标记为 ✅ 已完成
- 将该版本的详细章节从"规划版本"移入"已完成版本"
- 更新 `各版本核心变化对照表`
- 更新本文件（CLAUDE.md）底部的 `Current State` 章节，写明新完成的版本及关键路径

### Version Completion E2E Requirement

**每个版本开发完成后，必须运行 E2E 测试再标记版本完成。**

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

## Current State (v0.8 — Agents Management ✅)

v0.1 complete: monorepo scaffolding, three platform adapters scan real filesystem, `/platforms` API returns live data, frontend renders scan result cards with capability badges and rescan button.

v0.2 complete: UnifiedRule type system, FileRuleStore JSON persistence (`~/.prism/rules/rules.json`), `projectRule()` per-platform projection, `/rules` CRUD API (GET list, GET by id, POST create, PUT update, DELETE), Monaco editor frontend with projection preview panel, tab navigation between Scanner and Rules views.

v0.3 complete: Platform rule scanning — optional `importRules()` on each adapter reads real `.md` files from platform directories.

v0.4 complete: Profile system — `Profile` type (name, description, platformBindings, ruleIds), FileProfileStore JSON persistence (`~/.prism/profiles/profiles.json`), `/profiles` CRUD API, ProfilesPage list + ProfileEditorPage.

v0.5 complete: Publish Pipeline — `PublishEngine` writes rule files to platform config dirs with automatic backup; `FileRevisionStore` persists revision records to `~/.prism/revisions/`; `POST /profiles/:id/publish` API; `GET /revisions` + `GET /revisions/:id` + `POST /revisions/:id/rollback` API; ProfileEditorPage publish flow with dry-run preview and inline confirm; RevisionsPage with inline rollback confirm; Revisions top-level tab in the app shell.

v0.7 complete: Skills Management — `UnifiedSkill` type (id, name, trigger, category, tags, content, createdAt, updatedAt), `FileSkillStore` JSON persistence (`~/.prism/skills/skills.json`), `projectSkill()` per-platform projection; `importSkills()` on Claude Code adapter (recursive `~/.claude-internal/skills/**/*.md`) and CodeBuddy adapter (flat `~/.codebuddy/skills/`); PublishEngine extended to write skill files; `Profile.skillIds: string[]` added; `/skills` CRUD + projections API; SkillsPage list + SkillEditorPage with Monaco + projection preview; Skills tab in app shell (between Rules and Profiles).

v0.8 complete: Agents Management — `UnifiedAgent` type (id, name, agentType, description, tags, content, targetPlatforms, createdAt, updatedAt), `FileAgentStore` JSON persistence (`~/.prism/agents/agents.json`), `projectAgent()` per-platform projection; `importAgents()` on Claude Code adapter (recursive `~/.claude-internal/agents/**/*.md`) and CodeBuddy adapter (flat `~/.codebuddy/agents/`); PublishEngine extended to write agent files; `Profile.agentIds: string[]` added; `/agents` CRUD + projections API; AgentsPage list + AgentEditorPage with Monaco + projection preview; Agents tab in app shell (between Skills and Profiles).

### Key paths added in v0.5
- `packages/core/src/publish/` — PublishEngine, FileRevisionStore, platform-paths
- `packages/server/src/routes/publish.ts` — POST /profiles/:id/publish
- `packages/server/src/routes/revisions.ts` — GET/POST revision routes
- `apps/web/src/api/client.ts` — shared fetch client (request<T>())
- `apps/web/src/api/revisions.ts` — revisionsApi
- `apps/web/src/pages/RevisionsPage.tsx` — revision list + rollback UI

### Key paths added in v0.7
- `packages/shared/src/index.ts` — UnifiedSkill, CreateSkillDto, UpdateSkillDto, ImportedSkill types
- `packages/core/src/skills/` — FileSkillStore, projectSkill
- `packages/core/src/publish/platform-paths.ts` — getPlatformSkillsDir, skillFileName
- `packages/adapters/adapter-claude-code/` — importSkills (recursive ~/.claude-internal/skills/**/*.md)
- `packages/adapters/adapter-codebuddy/` — importSkills (flat ~/.codebuddy/skills/)
- `packages/server/src/routes/skills.ts` — /skills CRUD + projections routes
- `apps/web/src/api/skills.ts` — skillsApi
- `apps/web/src/pages/SkillsPage.tsx` — skill list with import button
- `apps/web/src/pages/SkillEditorPage.tsx` — Monaco editor + projection preview

### Key paths added in v0.8
- `packages/shared/src/index.ts` — UnifiedAgent, CreateAgentDto, UpdateAgentDto types
- `packages/core/src/agents/` — FileAgentStore, projectAgent
- `packages/core/src/publish/platform-paths.ts` — getPlatformAgentsDir, agentFileName
- `packages/adapters/adapter-claude-code/` — importAgents (recursive ~/.claude-internal/agents/**/*.md)
- `packages/adapters/adapter-codebuddy/` — importAgents (flat ~/.codebuddy/agents/)
- `packages/server/src/routes/agents.ts` — /agents CRUD + projections routes
- `apps/web/src/api/agents.ts` — agentsApi
- `apps/web/src/pages/AgentsPage.tsx` — agent list
- `apps/web/src/pages/AgentEditorPage.tsx` — Monaco editor + projection preview

### Server routes (complete list)
GET /health, GET /platforms, POST /scan,
GET /rules, POST /rules, GET /rules/:id, PUT /rules/:id, DELETE /rules/:id, GET /rules/:id/projections,
GET /skills, POST /skills, GET /skills/:id, PUT /skills/:id, DELETE /skills/:id, GET /skills/:id/projections,
GET /profiles, POST /profiles, GET /profiles/:id, PUT /profiles/:id, DELETE /profiles/:id, POST /profiles/:id/publish,
GET /revisions, GET /revisions/:id, POST /revisions/:id/rollback,
GET /agents, POST /agents, GET /agents/:id, PUT /agents/:id, DELETE /agents/:id, GET /agents/:id/projections
