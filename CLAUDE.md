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

Prism is a **Harness Engineering environment management tool** — it manages the infrastructure that AI agents depend on: Rules, Skills, Agents, MCP Servers, Hooks, and Commands, across multiple platforms (Claude Code, Codebuddy, OpenClaw). It is NOT a chat interface or agent runtime.

**Core Design Principles:**
1. **卸载安全**：Prism 永远不持有资产文件本身，只持有元数据和索引。文件永远住在各 IDE 目录。
2. **手动发布**：编辑永不自动写入 IDE 目录，所有变更需手动触发 diff preview → confirm → apply。
3. **文件优先**：IDE 目录里的文件是真相源，Prism 感知 IDE 目录变化并提示同步。

**Harness Engineering** = the 3-layer framework that makes agents work reliably:
1. Environment Design (CLAUDE.md / Rules / Skills / Agents)
2. Tool Integration (MCP Servers)
3. Feedback Mechanisms (Hooks / evaluators)

### Package Responsibilities

```
packages/shared/      → Pure types only. Zero dependencies.
                         Files: platform.ts, rule.ts, skill.ts, agent.ts,
                                mcp.ts, hook.ts, profile.ts, revision.ts, errors.ts

packages/core/        → Business logic, no HTTP dependency.
                         Store 层:
                           rules/dir-store.ts    → DirRuleStore，直接读写 ~/.claude-internal/rules/ 等
                           skills/dir-store.ts   → DirSkillStore，同上
                           agents/dir-store.ts   → DirAgentStore，同上
                           hooks/store.ts        → FileHookStore，读写 settings.json hooks 字段
                           mcp/store.ts          → FileMcpStore【⚠️ 存在 ~/.prism/mcp/servers.json，待迁移】
                           profiles/store.ts     → FileProfileStore
                           publish/engine.ts     → PublishEngine【⚠️ 只支持整 Profile 发布，Hooks 未接入】
                           publish/revision-store.ts → FileRevisionStore

packages/adapters/
  adapter-claude-code/ → 扫描 ~/.claude-internal (fallback ~/.claude)
  adapter-codebuddy/   → 扫描 ~/.codebuddy
  adapter-openclaw/    → 代码存在【⚠️ server/src/index.ts 未注册】

packages/server/      → Fastify API; wires stores → HTTP.
                         已有路由: /health, /platforms, /scan,
                           /rules, /skills, /agents, /mcp, /hooks,
                           /profiles, /publish, /revisions

apps/web/             → React + Vite 前端
                         已有页面: Rules, Skills, Agents, MCP, Hooks
                         (含列表页 + Monaco 编辑器 + Projection Preview)
                         Profiles/Revisions 页面按路由定义存在但需确认完整性
```

### Storage Layout

```
~/.claude-internal/          ← Claude Code 配置（Prism 直接读写）
├── rules/*.md
├── skills/*/SKILL.md
├── agents/*.md
└── settings.json            ← mcpServers + hooks 字段

~/.codebuddy/                ← Codebuddy 配置（同上）
└── ...（同结构）

~/.prism/                    ← Prism 自身数据目录
├── registry.json            ← 【待实现】资产索引，核心架构
├── mcp/servers.json         ← 【待迁移】MCP 配置，违反卸载安全原则
├── backups/{revisionId}/    ← 发布前自动备份
├── revisions/               ← 版本历史记录
└── overrides/               ← 【待实现】platform override 内容
```

### Key Store Implementations

**DirRuleStore** (`packages/core/src/rules/dir-store.ts`):
- 直接读写各 IDE 的 `rules/` 目录，文件格式：YAML frontmatter + markdown body
- `scope` 字段当前为 `'global' | 'project'`，**待扩展为** `'global' | 'platform-only' | 'override'`
- 已有 `platformOverrides` 字段（数据结构已备，UI 未暴露）

**FileHookStore** (`packages/core/src/hooks/store.ts`):
- 直接读写各 IDE 的 `settings.json` 的 `hooks` 字段
- 读取时扁平化为 `UnifiedHook[]`，写入时 GroupBy eventType，保留 settings.json 其他字段
- **这是最符合卸载安全原则的实现，可作为其他嵌入型资产的参考模式**

**FileMcpStore** (`packages/core/src/mcp/store.ts`):
- ⚠️ 当前存在 `~/.prism/mcp/servers.json`，违反卸载安全原则
- 发布时已实现 READ settings.json → MERGE mcpServers → WRITE 模式
- **v1.0 需要迁移**：去掉 Prism 副本，仅索引 settings.json 里的内容

### Data Flow

```
Browser → PUT /rules/:id
  → DirRuleStore.update()
    → 直接写入 ~/.claude-internal/rules/rule.md
    → （待实现）更新 registry.json 索引

Browser → POST /profiles/:id/publish
  → PublishEngine.publish(profileId)
    → backup 现有文件到 ~/.prism/backups/
    → 写入目标平台目录（rules/skills/agents/mcp）
    → 保存 Revision 记录
    ⚠️ Hooks 尚未接入此流程
```

### Key Type Definitions

`RuleScope` (in `packages/shared/src/rule.ts`) — **当前值，待扩展**:
```ts
type RuleScope = 'global' | 'project'
// 目标（v1.0）: 'global' | 'platform-only' | 'override'
```

`Profile` (in `packages/shared/src/profile.ts`) — **当前结构，待补充**:
```ts
interface Profile {
  id: string
  name: string
  description: string
  ruleIds: string[]
  skillIds: string[]
  agentIds: string[]
  mcpServerIds: string[]
  targetPlatforms: PlatformId[]
  createdAt: string
  updatedAt: string
  // ⚠️ 缺少: hookIds: string[]
  // ⚠️ 缺少: commandIds: string[]
}
```

`PlatformAdapter` (defined in `packages/core/src/types.ts`):
```ts
interface PlatformAdapter {
  id: PlatformId
  displayName: string
  capabilities: PlatformCapabilities
  scan: () => Promise<PlatformScanResult>
}
```

### TypeScript Path Aliases

All cross-package imports use `@prism/*` aliases (configured in `tsconfig.base.json`). All packages extend `tsconfig.base.json`. Module system is `ESNext` with `moduleResolution: Bundler`.

### Known Issues & Tech Debt

| 问题 | 位置 | 严重程度 |
|------|------|----------|
| MCP 数据存在 `~/.prism/mcp/` 违反卸载安全原则 | `core/src/mcp/store.ts` | 🔴 高 |
| OpenClaw adapter 有代码但未在 server 注册 | `server/src/index.ts` | 🟡 中 |
| Profile 缺少 `hookIds` 字段，Hook 无法进入发布流程 | `shared/src/profile.ts` | 🟡 中 |
| RuleScope 语义错误（`project` 应为 `platform-only`） | `shared/src/rule.ts` | 🟡 中 |
| PublishEngine 只支持整 Profile 发布，无法单资产发布 | `core/src/publish/engine.ts` | 🟡 中 |
| `FileRuleStore` 和 `DirRuleStore` 并存，两套实现 | `core/src/rules/` | 🟡 中 |
| 前端 `API_BASE` 硬编码 `localhost:3001` | `apps/web/src/` | 🟢 低 |
| `platformOverrides` 字段在 UI 完全不可见 | Rule 编辑器 | 🟢 低 |
| CORS: `@fastify/cors` 可能未安装 | `packages/server/` | 🟢 低 |

> CORS 临时解决方案：`cd packages/server && npm install @fastify/cors`

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
