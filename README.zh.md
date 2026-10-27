<div align="center">

<pre>
        ▲
 ██████╗ ██████╗ ██╗███████╗███╗   ███╗
 ██╔══██╗██╔══██╗██║██╔════╝████╗ ████║
 ██████╔╝██████╔╝██║███████╗██╔████╔██║
 ██╔═══╝ ██╔══██╗██║╚════██║██║╚██╔╝██║
 ██║     ██║  ██║██║███████║██║ ╚═╝ ██║
 ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝     ╚═╝
</pre>

**AI 编程环境的控制平面**

统一管理 Rules、Skills、Agents、MCP Servers、插件、Hooks 和 Commands
跨越你使用的每一款 AI 编程工具 —— 无需直接触碰它们的配置文件

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/version-0.10.1-orange.svg)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220.svg)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18.svg)](https://vitest.dev/)

[English](README.md) · 简体中文

</div>

---

## 问题所在

你同时使用 Claude Code、CodeBuddy、Cursor、Codex、OpenCode 等多款 AI 工具。每一款都有自己藏在 `~/` 深处的配置目录、各不相同的规则语法、私有的 MCP 格式。出问题时你不知道该改哪个文件；想换工具时只能靠手动复制粘贴规则。

**你的 AI 环境是一盘散沙。Prism 把它统一起来。**

---

## Prism 是什么

Prism 是 **Harness Engineering 的本地控制平面** —— 这门实践专注于搭建让 AI Agent 可靠运转的基础设施：

1. **环境设计** — Rules、Skills、Agents，塑造 Agent 的行为边界
2. **工具集成** — MCP Servers 和 Commands，扩展 Agent 的能力边界
3. **反馈机制** — Hooks 和评估器，保障 Agent 始终在轨

Prism 直接从各工具自己的目录和配置文件读取资产，让你在一个界面里统一管理。编辑某个资产（保存、删除、开关插件）会**立即**写入该工具的文件，只改动你编辑的部分。通过 **Profile** 跨平台发布则是更审慎的路径：先展示 dry-run diff，自动备份，可回滚。

| | |
|---|---|
| **扫描** | 检测已安装的 AI 工具（所有 `~/.*claude*` 目录、CodeBuddy、Cursor、Codex、OpenCode），定位它们的配置目录 |
| **管理** | 在统一的 Monaco 编辑器界面编辑所有资产类型 |
| **预览** | 发布前，精确查看每个平台将接收到什么 |
| **发布** | 带有 dry-run、diff、自动备份和完整回滚的安全写入 |
| **同步** | 将整个环境推送到 Git，在任意机器上一键恢复 |

---

## 三条设计原则

**卸载安全** — Prism 永远不持有你的文件。Rules、Skills、Agents、Hooks、MCP 配置都住在各自的 IDE 目录里，Prism 只持有元数据和索引。卸载 Prism 后所有文件完好无损。

**直接编辑，审慎发布** — 编辑单个资产会立即写回它所在的文件（保留无关字段和注释），单次编辑没有预览和备份。把一组资产推送到其他平台则通过 Profile：预览 diff → 确认 → 写入，并自动备份、记录可回滚的版本。不发布，就不会把任何内容复制到其他平台。

**文件优先** — IDE 目录里的文件是真相源。Prism 检测到外部变更时会提示你同步，文件系统永远优先。

---

## 功能

### 资产管理

| 资产类型 | 能力 |
|---------|------|
| **Rules（规则）** | 完整 CRUD · Monaco 编辑器 · 各平台投影预览 · 从 IDE 目录导入 |
| **Skills（技能）** | 完整 CRUD · Monaco 编辑器 · 各平台投影预览 · 从 IDE 目录导入 |
| **Agents（代理）** | 完整 CRUD · Monaco 编辑器 · 各平台投影预览 · 从 IDE 目录导入 |
| **Commands（命令）** | 完整 CRUD · Monaco 编辑器 |
| **MCP Servers** | 完整 CRUD · stdio / http / sse · 直接读写各工具原生配置（JSON、JSONC、TOML）· 从其他平台导入 |
| **Hooks（钩子）** | 完整 CRUD · 表单编辑器 · 读写 `settings.json` hooks 字段 |
| **Plugins（插件）** | 列出已安装插件及其包含的 skill / agent / command / MCP / hook · 启用 / 禁用 |

编辑时会保留文件原生的 front matter 字段（`globs`、`alwaysApply`、`allowed-tools` 等）、文件扩展名，以及配置文件中无关的键和注释。

列表页直接展示每个资产的**描述摘要**，支持搜索。插件提供的资产显示在**你自己的资产下方**，每个插件一个默认收起的只读分组：可按来源筛选、跨所有来源搜索，点开在只读面板中查看全文。侧边栏计数形如 `自己 +插件`。

### 支持的平台

| 平台 | 位置 | Rules | Skills | Agents | Commands | MCP | Hooks | 插件 |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Claude Code** | 所有 `~/.*claude*` 配置目录（如 `~/.claude`、`~/.tclaude`）及 `CLAUDE_CONFIG_DIR`，每个目录一个实例 | ✓ | ✓ | ✓ | ✓ | ✓ `.claude.json` | ✓ | ✓ 可开关 |
| **CodeBuddy** | `~/.codebuddy` | ✓ `.mdc` | ✓ | ✓ | ✓ | ✓ `mcp.json` | ✓ | ✓ 可开关 |
| **Cursor** | `~/.cursor` | ✓ | ✓ | ✓ | ✓ | ✓ `mcp.json` | — | 只读 |
| **Codex** | `~/.codex`（`CODEX_HOME`） | — | ✓ | — | ✓ prompts | ✓ `config.toml` | — | ✓ 可开关 |
| **OpenCode** | `~/.config/opencode` | — | ✓ | ✓ | ✓ | ✓ `opencode.json(c)` | — | 只读 |

只有本机实际安装的工具才会出现；侧边栏只显示该平台支持的功能。

### Profile 与发布

将任意组合的 Rules、Skills、Agents、Commands、MCP Servers 和 Hooks 组合为一个 **Profile**，一次操作发布到一个或多个平台。

每次发布都会：
- 展示 **dry-run diff**，写入前你能看到完整变更
- 自动备份到 `~/.prism/backups/`
- 写入**版本历史记录**，随时通过"版本历史"标签页完整回滚

### 知识库（已隐藏）

从 AI 会话中沉淀知识并生成 Rules / Skills 的功能**暂时从界面隐藏**，采集流程待重做（`Stop` 钩子传来的是 `transcript_path`，而不是对话内容本身）。相关 API 和 `~/.prism/knowledge/` 下的数据都保留。

### Git 同步

你的 AI 环境是代码，就该用代码的方式管理。

- 在 `~/.prism/` 目录初始化 Git 仓库
- 将整个配置（rules、skills、agents、MCP、hooks、knowledge）打包为可移植的 export package 推送到远端
- 在任意其他机器上拉取，一键恢复完整环境
- **冲突解决 UI**：当本地与远端出现分歧时，可视化选择保留哪方，或手动合并

### 文件监视

Prism 持续监视 IDE 配置目录，检测到外部修改（例如直接在 Claude Code 里编辑的变更）时，在界面顶部展示提示横幅，保持 Prism 视图与实际文件始终一致。

---

## 快速开始

**前置要求：** Node.js 20+、pnpm 9+

```bash
git clone https://github.com/yourusername/prism.git
cd prism
pnpm install
pnpm dev
```

- 前端：**http://localhost:5173**
- API：**http://localhost:3001**

```bash
# 验证 API 是否正常运行
curl http://localhost:3001/health

# 查看 Prism 检测到了哪些 AI 工具
curl http://localhost:3001/platforms

# 触发重新扫描
curl -X POST http://localhost:3001/scan
```

---

## 架构

Prism 是一个 TypeScript monorepo，每一层职责单一：

```
packages/
├── shared/              纯类型定义，零依赖
│                        (PlatformId、UnifiedRule、UnifiedSkill、Profile、
│                         GitSyncConfig、KnowledgeEntry、GeneratedAsset 等)
│
├── core/                业务逻辑层，无 HTTP 依赖
│   ├── rules/           DirRuleStore      → 读写 ~/.{ide}/rules/
│   ├── skills/          DirSkillStore     → 读写 ~/.{ide}/skills/
│   ├── agents/          DirAgentStore     → 读写 ~/.{ide}/agents/
│   ├── commands/        DirCommandStore   → 读写 ~/.{ide}/commands/
│   ├── hooks/           FileHookStore     → 读写 settings.json hooks 字段
│   ├── mcp/             NativeMcpStore    → 读写各平台原生 MCP 配置（JSON/JSONC/TOML）
│   ├── plugins/         PluginStore       → 列出已安装插件、启用/禁用
│   ├── platforms/       平台发现          → ~/.*claude* 通配 + CodeBuddy/Cursor/Codex/OpenCode
│   ├── profiles/        FileProfileStore  → 读写 ~/.prism/profiles/
│   ├── publish/         PublishEngine     → dry-run · diff · 备份 · 版本历史
│   ├── git-sync/        GitSyncService    → 克隆 · 推拉 · 冲突检测
│   ├── knowledge/       KnowledgeStore    → 条目 · 开发者档案 · 资产生成
│   ├── registry/        RegistryStore     → 跨平台资产索引
│   └── watcher/         FileWatcher       → 检测外部配置变更
│
└── server/              Fastify API，将 Store 层接入 HTTP

apps/
└── web/                 React + Vite，Monaco 编辑器，中英文双语（i18n）
```

### 存储结构

```
~/.claude/ ~/.tclaude/ …   ← Claude Code（所有 ~/.*claude* 配置目录，各为一个实例）
    ├── rules/ skills/ agents/ commands/
    ├── settings.json        hooks + enabledPlugins
    └── plugins/installed_plugins.json
~/.claude.json              ← ~/.claude 实例的 MCP（其他实例为 <dir>/.claude.json）
~/.codebuddy/               ← CodeBuddy：rules/*.mdc、skills、agents、commands、mcp.json、settings.json
~/.cursor/                  ← Cursor：rules、skills、agents、commands、mcp.json、plugins/cache
~/.codex/                   ← Codex：skills、prompts、config.toml（mcp_servers + plugins）
~/.config/opencode/         ← OpenCode：agents、commands、skills、opencode.json(c)（mcp + plugin）

~/.prism/             ← Prism 自身数据（仅元数据和索引）
    ├── profiles/profiles.json
    ├── knowledge/
    ├── git-sync/
    ├── backups/{revisionId}/
    └── revisions/
```

### 数据流

```
浏览器  →  PUT /rules/:id
             → DirRuleStore.update()
               → 原地写入 ~/.claude/rules/rule.md（保留原生 front matter）
               → 更新 registry 索引

浏览器  →  POST /profiles/:id/publish
             → PublishEngine.publish()
               → 备份现有文件到 ~/.prism/backups/
               → 将 rules/skills/agents/mcp/hooks 写入目标平台目录
               → 记录 Revision 条目供回滚使用

浏览器  →  POST /git-sync/push
             → GitSyncService.push()
               → 序列化 registry + overrides + knowledge → export package
               → git add · commit · push 到远端
```

---

## 开发命令

```bash
pnpm dev              # 并行启动所有包（API + 前端）
pnpm test             # 运行所有单元测试（Vitest）
pnpm typecheck        # 对全部 4 个包进行类型检查（shared、core、server、web）
pnpm lint             # ESLint
pnpm build            # 全量构建（Turbo 依赖顺序）

# 单独运行某个包
pnpm --filter @prism/server dev    # Fastify API on :3001
pnpm --filter @prism/web dev       # Vite 前端 on :5173
```

### E2E 测试（Playwright）

E2E 测试会真实地新建、修改、删除配置条目，**绝不要对自己的 HOME 运行**。先用一个放着配置副本的沙箱 HOME 启动 API，再让测试指向它：

```bash
HOME=/tmp/prism-e2e-home pnpm --filter @prism/server dev   # 同时取消 CLAUDE_CONFIG_DIR / CODEX_HOME
pnpm --filter @prism/web dev
PRISM_E2E_HOME=/tmp/prism-e2e-home npx playwright test
```

如果 API 没有使用沙箱 HOME，`tests/platforms-mcp-plugins.spec.ts` 会拒绝运行。

---

## 添加平台

平台在 `packages/core/src/platforms/instances.ts` 中声明式描述：新增一个 `build<Tool>Instance()`，
返回该工具各类资产所在位置（rules/skills/agents/commands 目录、MCP 配置路径及方言、插件来源、
hooks 所在 settings 文件，不支持的填 `null`），再在 `discoverPlatformInstances()` 中加入检测即可，
server 和前端会自动识别。

---

## 参与贡献

目前最有价值的贡献方向：

- **新平台** — Copilot、Windsurf、Gemini CLI、Kiro（见「添加平台」）
- **投影逻辑** — 一条 Rule 如何映射到不同平台的具体格式？
- **知识采集** — 从 `transcript_path` 读取会话记录并生成像样的摘要
- **测试夹具** — 来自不同工具的真实配置样本，用于集成测试

发送大型 PR 之前请先开 Issue。小而聚焦的 PR 合并更快。

---

## 许可证

[MIT](LICENSE) — 随便用，保留版权声明就行。

---

<div align="center">

为那些希望 AI 工具与自己协作、而非绕着自己走的开发者而建。

</div>
