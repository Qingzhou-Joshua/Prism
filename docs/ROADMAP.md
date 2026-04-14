# Prism 版本路线图

更新时间：2026-04-14（v0.8 标记完成：Agents 资产管理全流程上线，包括 CRUD、importAgents()、PublishEngine 扩展、AgentsPage/AgentEditorPage 前端，E2E 验证通过）

---

## 产品定位

> **Prism is a Harness Engineering environment management tool.**
>
> Scan locally. Edit once. Publish selectively. Preview safely.

**Harness Engineering** 是指构建和管理 AI Agent 运行所依赖的基础设施环境——不是 Agent 本身，而是让 Agent 能高效、稳定、可重现地工作的整套环境配置。

Prism 负责 Harness Engineering 中的**环境资产治理**层：

- **环境设计**：统一管理 CLAUDE.md / Rules / Skills / Agents 等配置资产
- **工具集成**：MCP Servers 管理，打通 AI Agent 与外部工具的连接
- **反馈机制**：Hooks 管理，驱动 AI 工作流自动化触发器与质量门禁
- **跨平台治理**：按平台选择性发布，不强制全量同步
- **安全可回溯**：发布前 preview / diff / backup / confirm，发布后可回滚
- **配置导入**：从各平台现有配置导入到 Prism 统一库

---

## 版本状态总览

| 版本 | 主题 | 状态 |
|------|------|------|
| v0.1 | Scanner PoC | ✅ 已完成 |
| v0.2 | Rule Editor PoC | ✅ 已完成 |
| v0.3 | Platform Rule Scanning | ✅ 已完成 |
| v0.4 | Profile PoC | ✅ 已完成 |
| v0.5 | MVP — Publish Pipeline | ✅ 已完成 |
| v0.6 | Rule Import Flow | ✅ 已完成 |
| v0.7 | Skills 资产管理 | ✅ 已完成 |
| v0.8 | Agents 资产管理 | ✅ 已完成 |
| v0.9 | MCP Servers 管理 | 🔭 规划中 |
| v0.10 | CLI — 完整功能里程碑 | 🔭 规划中 |
| v0.11 | Hooks 管理 | 🔭 规划中 |
| v0.12 | Export / Git Sync（轻量版） | 🔭 规划中 |
| v0.13 | Templates 模板库 | 🔭 规划中 |
| v0.14 | Health Dashboard | 🔭 规划中 |
| v1.x | 云端集成 | 🔭 远期规划 |

---

## 已完成版本

### v0.1 — Scanner PoC ✅

**目标**：验证多平台本地扫描可行性

完成内容：
- Monorepo 脚手架（pnpm + Turbo）
- Fastify 后端（:3001）+ Vite 前端（:5173）
- 三个平台适配器：OpenClaw / CodeBuddy / Claude Code
- 真实文件系统扫描（不是 mock）
- `GET /health`, `GET /platforms`, `POST /scan` API
- 前端平台卡片 + detected badge + capabilities 展示
- Rescan 按钮（带 loading / error 状态）
- `@fastify/cors` CORS 修复

**意义**：证明 Prism 能读取用户真实 AI 工具安装状态，而不是"PPT 产品"。

---

### v0.2 — Rule Editor PoC ✅

**目标**：实现第一版配置资产管理

完成内容：
- `UnifiedRule` 类型（scope、tags、targetPlatforms、platformOverrides）
- `FileRuleStore` JSON 持久化（`~/.prism/rules/rules.json`）
- `projectRule()` 每平台 projection 逻辑
- Rules CRUD API（GET list, GET by id, POST, PUT, DELETE）
- `GET /rules/:id/projections` 多平台预览端点
- Monaco Editor 前端编辑器
- Rules Tab 与 Scanner Tab 并列导航
- Projection Preview 右侧面板

**意义**：Prism 从"扫描工具"进化为"配置资产管理器"。

---

### v0.3 — Platform Rule Scanning ✅

**目标**：读取平台真实安装的规则文件，弥合"平台扫描"与"规则管理"之间的断层

**完成内容**：

1. **适配器新增 `importRules()` 方法**（均为只读，不写入平台目录）
   - Claude Code adapter：读取 `~/.claude-internal/rules/*.md`（回退 `~/.claude/rules/*.md`）
   - OpenClaw adapter：读取 `~/.openclaw/rules/*.md`
   - CodeBuddy adapter：读取 `~/.codebuddy/rules/*.md`

2. **新增 API 端点**
   - `GET /platforms/:id/rules` — 返回平台真实规则列表

3. **前端平台视图**
   - Rules Tab 新增平台子 tab：`[Prism Rules] [Claude Code] [OpenClaw] [CodeBuddy]`
   - 每个平台 tab 展示真实安装的规则文件，支持点击展开查看内容
   - 空状态展示（平台无规则 / 规则目录不存在）

**意义**：Prism 开始"感知"平台真实状态，不再只管理自己内部的规则库。

---

### v0.4 — Profile PoC ✅

**目标**：支持规则组合与多平台绑定

完成内容：
- `Profile` 类型（Rule 集合 + 目标平台绑定）
- `FileProfileStore` JSON 持久化（`~/.prism/profiles/profiles.json`）
- Profile CRUD API（GET list, GET by id, POST, PUT, DELETE）
- 前端 Profile 管理页面
- Publish Dry-run Preview（预览发布将影响哪些文件）

**意义**：从"编辑一条规则"到"管理一套规则组合"。

---

### v0.5 — MVP：Publish Pipeline ✅

**目标**：实现真实写入，完成"发布"这个核心动作

完成内容：
- 从 Preview → 可执行 Publish
- 写入目标平台配置文件（`~/.claude-internal/rules/`, `~/.openclaw/rules/`, 等）
- 写入前自动 backup
- `Revision` 记录（谁、什么时候、发布了什么）
- diff / confirm / apply 流程
- 基础回滚（从 backup 恢复）
- Revisions 页面与回滚 UI

**意义**：Prism 完成从"看"到"做"的闭环，成为真正可用的发布工具。

---

### v0.6 — Rule Import Flow ✅

**目标**：让用户能在 Scanner 页面将各平台现有的 `.md` 规则文件导入到 Prism 统一规则库

完成内容：
1. **类型定义** — `ImportableRule` interface
2. **冲突检测** — 纯函数 `detectConflicts()` 与单元测试
3. **前端 UI** — PlatformCard 展开面板，per-rule 状态机
4. **导入流程** — 支持全选、冲突覆盖、串行导入、汇总显示
5. **E2E 测试** — Playwright 完整导入流程验证

**意义**：规则导入工作流完整闭合，用户可以从现有平台无缝迁移规则到 Prism。

---

### v0.7 — Skills 资产管理 ✅

**目标**：将 Skills（Claude Code Skills / 自定义命令技能）纳入 Prism 统一管理

**背景**：
Skills 在 Claude Code 中以 `.md` 文件形式存放于 `~/.claude-internal/skills/`，定义可复用的任务流程。CodeBuddy 也有 `~/.codebuddy/skills/` 目录。当开发者在多台设备或多个项目间工作时，Skills 的管理和同步是高频痛点。

**完成内容**：

1. **类型定义**（`packages/shared/src/index.ts`）
   ```typescript
   interface UnifiedSkill {
     id: string
     name: string
     description?: string
     content: string              // Markdown 内容
     tags: string[]
     targetPlatforms: PlatformId[]
     createdAt: string
     updatedAt: string
   }
   ```

2. **FileSkillStore**（`packages/core/src/skills/FileSkillStore.ts`）
   - 持久化路径：`~/.prism/skills/skills.json`
   - 遵循 FileRuleStore 相同的 `writeQueue` 序列化写入模式

3. **平台适配器 `importSkills()`**
   - Claude Code adapter：递归读取 `~/.claude-internal/skills/**/*.md`
   - CodeBuddy adapter：平面读取 `~/.codebuddy/skills/*.md`

4. **API 端点**（`packages/server/src/routes/skills.ts`）
   - 完整 CRUD：`GET/POST /skills`, `GET/PUT/DELETE /skills/:id`
   - `GET /skills/:id/projections` — 多平台预览

5. **PublishEngine 扩展**
   - 支持将 Skills 写入目标平台目录，发布前 backup

6. **前端页面**
   - SkillsPage 列表 + SkillEditorPage（Monaco 编辑器 + projection preview）
   - Skills 顶级 Tab（位于 Rules 和 Profiles 之间）

7. **Profile 扩展**
   ```typescript
   interface Profile {
     // 现有字段...
     skillIds: string[]           // 新增
   }
   ```

**关键路径**：
- `packages/shared/src/index.ts` — UnifiedSkill, CreateSkillDto, UpdateSkillDto
- `packages/core/src/skills/` — FileSkillStore, projectSkill
- `packages/core/src/publish/platform-paths.ts` — getPlatformSkillsDir, skillFileName
- `packages/server/src/routes/skills.ts` — CRUD + projections
- `apps/web/src/pages/SkillsPage.tsx`, `SkillEditorPage.tsx`

**意义**：Prism 从"Rules 管理器"升级为"AI 工作流资产管理器"，Skills 是扩展的第一步。

---

### v0.8 — Agents 资产管理 ✅

**目标**：将 Agents（Claude Code subagents / CodeBuddy 自定义 agent 定义文件）纳入 Prism 统一管理

**背景**：
Claude Code 支持在 `~/.claude-internal/agents/` 目录下定义自定义 agent，CodeBuddy 在 `~/.codebuddy/agents/` 有相同约定。每个 `.md` 文件描述一个专门的子代理角色（如 code-reviewer、tdd-guide 等）。Agent 文件使用 YAML frontmatter 描述元数据，markdown body 描述 agent 行为。这些 agent 定义是 Harness Engineering 中最核心的资产之一。

**Agent 文件格式**（claude-code 与 codebuddy 格式完全相同）：
```yaml
---
name: code-reviewer
description: Expert code review specialist...
tools: ["Read", "Grep", "Glob", "Bash"]
model: sonnet
---
[markdown body: agent instructions]
```

**完成内容**：

1. **类型定义**（`packages/shared/src/index.ts`）
   - `UnifiedAgent`, `CreateAgentDto`, `UpdateAgentDto`, `ImportedAgent`

2. **FileAgentStore**（`packages/core/src/agents/FileAgentStore.ts`）
   - 持久化路径：`~/.prism/agents/agents.json`
   - 遵循 FileRuleStore / FileSkillStore 相同的 `writeQueue` 序列化写入模式

3. **importAgents() 适配器扩展**
   - Claude Code adapter：递归读取 `~/.claude-internal/agents/**/*.md`（回退 `~/.claude/agents/*.md`）
   - CodeBuddy adapter：平面读取 `~/.codebuddy/agents/*.md`

4. **projectAgent()**（`packages/core/src/agents/projectAgent.ts`）
   - 将 UnifiedAgent 投影为目标平台的 agent 文件内容
   - 重新生成 frontmatter（name、description、tools、model）+ content body

5. **API 端点**（`packages/server/src/routes/agents.ts`）
   - 完整 CRUD：`GET/POST /agents`, `GET/PUT/DELETE /agents/:id`
   - `GET /agents/:id/projections` — 多平台预览

6. **PublishEngine 扩展**（`packages/core/src/publish/PublishEngine.ts`）
   - 写入路径：`~/.claude-internal/agents/`, `~/.codebuddy/agents/`
   - 发布前 backup，记录 Revision

7. **前端页面**
   - `AgentsPage.tsx` 列表 + `AgentEditorPage.tsx`（Monaco 编辑器 + projection preview）
   - Agents 顶级 Tab（位于 Skills 和 Profiles 之间）

8. **Profile 扩展**
   ```typescript
   interface Profile {
     // 现有字段...
     skillIds: string[]
     agentIds: string[]           // 新增
   }
   ```

**关键路径**：
- `packages/shared/src/index.ts` — UnifiedAgent, CreateAgentDto, UpdateAgentDto, ImportedAgent
- `packages/core/src/agents/` — FileAgentStore, projectAgent
- `packages/core/src/publish/platform-paths.ts` — getPlatformAgentsDir, agentFileName
- `packages/adapters/adapter-claude-code/` — importAgents (递归 ~/.claude-internal/agents/**/*.md)
- `packages/adapters/adapter-codebuddy/` — importAgents (平面 ~/.codebuddy/agents/)
- `packages/server/src/routes/agents.ts` — CRUD + projections
- `apps/web/src/pages/AgentsPage.tsx`, `AgentEditorPage.tsx`

**意义**：至 v0.8 完成后，Prism 可管理 Rules + Skills + Agents 三类核心 AI 工作流资产，覆盖 Harness Engineering 环境设计层的主要配置。E2E 验证通过（Scanner、Agents 列表/编辑、Delete Profile、Create+Delete Agent 全流程）。

---

## 规划版本（v0.9 → v1.x）

### v0.9 — MCP Servers 管理 🔭

**目标**：将 MCP Server 配置纳入 Prism 统一管理，覆盖 AI 开发环境中的工具集成层

**背景**：
Claude Code、Cursor 等工具支持 MCP（Model Context Protocol）服务器，配置存储于各平台的 settings 文件中（如 `~/.claude-internal/settings.json` 中的 `mcpServers` 字段）。开发者常需在多平台间同步 MCP 配置。

**完成内容**：

1. **类型定义**（`packages/shared/src/mcp.ts`）
   ```typescript
   interface McpServer {
     id: string
     name: string                 // 在 settings 中的 key（如 "context7"）
     command: string              // 启动命令（如 "npx"）
     args: string[]               // 参数列表
     env?: Record<string, string> // 环境变量
     description?: string
     targetPlatforms: PlatformId[]
     createdAt: string
     updatedAt: string
   }
   interface ImportableMcpServer {
     name: string
     command: string
     args: string[]
     env?: Record<string, string>
   }
   ```

2. **FileMcpStore**（`packages/core/src/stores/FileMcpStore.ts`）
   - 持久化路径：`~/.prism/mcp/mcp.json`

3. **PlatformAdapter MCP 读取**
   ```typescript
   interface PlatformAdapter {
     importMcp?: () => Promise<ImportableMcpServer[]>
   }
   ```
   - Claude Code adapter：解析 `~/.claude-internal/settings.json` 中的 `mcpServers` 字段
   - Cursor adapter：解析 `.cursor/mcp.json`（如存在）

4. **API 端点**（`packages/server/src/routes/mcp.ts`）
   - 完整 CRUD：`GET/POST /mcp`, `GET/PUT/DELETE /mcp/:id`
   - `GET /platforms/:id/mcp` — 读取平台真实 MCP 配置

5. **前端页面**（`apps/web/src/pages/McpPage.tsx`）
   - App.tsx 新增 MCP 顶级 Tab
   - MCP Server 列表：展示名称、命令、目标平台
   - 表单编辑（命令、参数、环境变量）而非 Monaco 编辑器
   - Scanner 导入流程（同 Rules 导入模式）

6. **Profile 扩展**
   ```typescript
   interface Profile {
     // 现有字段...
     agentIds: string[]
     mcpServerIds: string[]       // 新增
   }
   ```

7. **PublishEngine 扩展**
   - MCP：将 McpServer 写入目标平台 settings 的 `mcpServers` 字段（merge 而不是覆盖）

**意义**：Prism 覆盖 Harness Engineering 的工具集成层，AI Agent 的外部工具接入纳入统一治理。

---

### v0.10 — Hooks 管理 🔭

**目标**：将 Hooks 配置纳入 Prism 统一管理，覆盖 AI 工作流的反馈与自动化触发器层

**背景**：
Claude Code 支持 PreToolUse / PostToolUse / Stop / Notification hooks，存储于 `~/.claude-internal/settings.json` 的 `hooks` 字段。Hooks 是 Harness Engineering 中反馈机制的核心——格式检查、质量门禁、自动化触发器均通过 Hooks 实现。

**完成内容**：

1. **类型定义**（`packages/shared/src/hook.ts`）
   ```typescript
   type HookType = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification'
   interface Hook {
     id: string
     name: string
     hookType: HookType
     matcher?: string             // 工具匹配模式（如 "Write|Edit"）
     command: string              // shell 命令
     description?: string
     targetPlatforms: PlatformId[]
     createdAt: string
     updatedAt: string
   }
   interface ImportableHook {
     hookType: HookType
     matcher?: string
     command: string
     description?: string
   }
   ```

2. **FileHookStore**（`packages/core/src/stores/FileHookStore.ts`）
   - 持久化路径：`~/.prism/hooks/hooks.json`

3. **PlatformAdapter Hooks 读取**
   ```typescript
   interface PlatformAdapter {
     importHooks?: () => Promise<ImportableHook[]>
   }
   ```
   - Claude Code adapter：解析 `~/.claude-internal/settings.json` 中的 `hooks` 字段

4. **API 端点**（`packages/server/src/routes/hooks.ts`）
   - 完整 CRUD：`GET/POST /hooks`, `GET/PUT/DELETE /hooks/:id`
   - `GET /platforms/:id/hooks` — 读取平台真实 Hooks 配置

5. **前端页面**（`apps/web/src/pages/HooksPage.tsx`）
   - App.tsx 新增 Hooks 顶级 Tab
   - Hooks 列表：展示名称、类型（PreToolUse/PostToolUse/Stop）、匹配器、命令
   - 表单编辑（类型选择、matcher、command）

6. **Profile 完整扩展**
   ```typescript
   interface Profile {
     id: string
     name: string
     description?: string
     ruleIds: string[]
     skillIds: string[]
     agentIds: string[]
     mcpServerIds: string[]
     hookIds: string[]            // 新增
     targetPlatforms: PlatformId[]
     createdAt: string
     updatedAt: string
   }
   ```

7. **PublishEngine 扩展**
   - Hooks：将 Hook 写入目标平台 settings 的 `hooks` 字段（merge 而不是覆盖）

8. **PlatformCapabilities 扩展**
   ```typescript
   interface PlatformCapabilities {
     rules: boolean
     profiles: boolean
     skills: boolean
     agents: boolean
     mcp: boolean
     hooks: boolean               // 新增
   }
   ```

**意义**：至 v0.10 完成后，Prism 已覆盖 Harness Engineering 的三个核心层：环境设计（Rules/Skills/Agents）、工具集成（MCP）、反馈机制（Hooks）。Profile 成为完整的"AI 开发环境快照"。

---

### v0.11 — Export / Git Sync 🔭

**目标**：支持将 Prism 管理的配置资产导出为 Git 仓库，实现跨设备同步与版本控制

**背景**：
Prism 本质上是本地资产库（`~/.prism/`）。用户需要在多台机器间同步 Harness Engineering 配置，或将配置纳入团队版本控制。

**计划内容**：

1. **Export 功能**
   - 将 `~/.prism/` 下的所有资产导出为可 git-tracked 的目录结构
   - 生成 human-readable YAML/Markdown 格式（而非 JSON）

2. **Git Sync**
   - 支持配置一个 git remote，自动 push/pull Prism 配置
   - 冲突检测与合并策略

3. **Import from Git**
   - 从 git 仓库导入配置资产到本地 Prism 库

**意义**：Prism 配置可跨设备共享，团队可通过 git 协作管理 Harness Engineering 环境。

---

### v0.12 — Health Dashboard 🔭

**目标**：可视化 AI 开发环境的健康状态，提供环境诊断与优化建议

**背景**：
随着配置资产增多，用户需要一个全局视图来了解当前 Harness Engineering 环境的状态：哪些 Agents 已发布、哪些 Hooks 有冲突、哪些 MCP Servers 未配置等。

**计划内容**：

1. **Environment Health Score**
   - 基于各类资产的完整度、一致性评分
   - 展示各平台的配置覆盖率

2. **Diagnostics Panel**
   - 检测常见问题：缺失 CLAUDE.md、hooks 命令失效、agent 文件格式错误
   - 提供修复建议

3. **Asset Coverage Map**
   - 可视化各平台已发布 vs 待发布的资产矩阵
   - 一键补全缺失资产

**意义**：Prism 从"配置管理工具"进化为"Harness Engineering 诊断平台"，主动帮助用户优化 AI 工作流环境。

---

## 各版本核心变化对照表

| 资产类型 | 引入版本 | 涉及变更 |
|---------|---------|---------|
| Rules | v0.2 | UnifiedRule, FileRuleStore, /rules CRUD |
| Rules Import | v0.6 | importRules(), 冲突检测, 导入 UI |
| Skills | v0.7 | UnifiedSkill, FileSkillStore, /skills CRUD, importSkills(), SkillsPage |
| Agents | v0.8 | UnifiedAgent (tools[], model), FileAgentStore, /agents CRUD, importAgents(), AgentsPage |
| MCP Servers | v0.9 | McpServer, FileMcpStore, /mcp CRUD, importMcp(), McpPage |
| Hooks | v0.10 | Hook, FileHookStore, /hooks CRUD, importHooks(), HooksPage |
| Export/Git Sync | v0.11 | export 命令, git remote 配置, import from git |
| Health Dashboard | v0.12 | 环境健康评分, 诊断面板, 资产覆盖矩阵 |
| Profile（完整） | v0.10 | skillIds + agentIds + mcpServerIds + hookIds |
| PublishEngine（完整） | v0.10 | 支持所有资产类型写入 + diff 预览 |

---

## 设计原则（贯穿所有版本）

### 资产扩展模式（每类新资产遵循相同步骤）

每新增一类资产（如 Agents），固定遵循以下模式：

```
1. packages/shared/src/<asset>.ts          → 定义 Unified 类型 + Importable 类型
2. packages/core/src/<asset>s/File<Asset>Store.ts → FileStore 实现（复用 writeQueue 模式）
3. packages/core/src/types.ts              → PlatformAdapter 新增 import<Asset>?() 方法
4. packages/<platform>-adapter/src/index.ts → 各平台适配器实现 import<Asset>()
5. packages/server/src/routes/<asset>s.ts  → CRUD API + /platforms/:id/<asset>s 端点
6. apps/web/src/pages/<Asset>sPage.tsx     → 列表 + 编辑器 + 导入流程
7. packages/shared/src/profile.ts         → Profile 新增 <asset>Ids: string[]
8. packages/core/src/publish/PublishEngine.ts → 支持新资产类型发布
```

> ⚠️ **延迟抽象原则**：`createFileStore<T>()`、`createCrudRoutes<T>()`、`AssetPage<T>` 等泛型抽象**推迟到 v0.9 完成后**再评估。先跑通 Agents，再考虑复用模式。

### 坚守原则

✅ 应该做的：
- 统一管理，选择性发布（manage centrally, publish selectively）
- 真实扫描，真实路径，真实预览
- Adapter 架构，支持多平台扩展
- 智能冲突检测与资产导入
- 发布前 diff / backup / confirm，发布后可回滚

❌ 不应该做的：
- 强制全量同步
- 退化成"rules sync 小工具"
- 过早抽象（先跑通一类资产，再复用模式）
- 在未 backup 的情况下写入平台配置文件
- 自动覆盖冲突（始终需要用户确认）

---

## 竞品定位分析

### 市场现状

| 类型 | 代表产品 | 局限性 |
|------|---------|--------|
| 规则转换工具 | cursor2claude, rulesync | 只解决两平台规则互转 |
| 统一同步工具 | Vibe Manager, Agent Rules Sync | "edit once, sync everywhere"——强制全量同步 |
| 手工教程/脚本 | 社区博文、Shell 脚本 | 无持久化、无治理、只管 rules |

### Prism 的差异化空间

| 问题 | 现有方案 | Prism |
|------|---------|-------|
| 本机有哪些 AI 平台？ | ❌ | ✅ 扫描检测 |
| 各平台配置根在哪里？ | ❌ | ✅ 真实路径识别 |
| Rules/Skills/Agents/MCP/Hooks 统一视图？ | ❌ | ✅ 五类资产统一管理 |
| 能否选择性发布？ | ❌ 全量同步 | ✅ 选择性发布 |
| 发布前能预览全量 diff？ | ❌ | ✅ 所有资产类型 diff |
| 发布后能回滚？ | ❌ | ✅ revision + rollback |
| 能否导入现有配置？ | ❌ | ✅ 各资产类型均支持导入 |
| 跨平台一键发布"AI 环境快照"？ | ❌ | ✅ Profile 机制 |

**结论**：Prism 是面向 Harness Engineering 的本地 AI 开发环境治理平台——将 Rules、Skills、Agents、MCP Servers、Hooks 纳入统一治理，让开发者能像管理代码一样管理 AI 工作流环境。

---

## 注意事项

- 所有版本文件写入操作**仅在用户确认**后执行
- 所有适配器的读操作**不写入任何平台目录**
- 资产导入遇到冲突时**不自动覆盖**，需用户明确选择
- 所有 Revisions **可回滚**，但需确保 backup 文件完整
- MCP / Hooks 写入 settings 文件时采用 **merge 策略**，不覆盖用户其他配置项
