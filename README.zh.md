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

统一管理 Rules、Skills、Agents、MCP Servers、Hooks 和 Commands
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

你同时使用 Claude Code、Codebuddy、OpenClaw 等多款 AI 工具。每一款都有自己藏在 `~/` 深处的配置目录、各不相同的规则语法、私有的 MCP 格式。出问题时你不知道该改哪个文件；想换工具时只能靠手动复制粘贴规则。

**你的 AI 环境是一盘散沙。Prism 把它统一起来。**

---

## Prism 是什么

Prism 是 **Harness Engineering 的本地控制平面** —— 这门实践专注于搭建让 AI Agent 可靠运转的基础设施：

1. **环境设计** — Rules、Skills、Agents，塑造 Agent 的行为边界
2. **工具集成** — MCP Servers 和 Commands，扩展 Agent 的能力边界
3. **反馈机制** — Hooks 和评估器，保障 Agent 始终在轨

Prism 绝不直接覆写你的 IDE 配置。它从 IDE 目录读取资产，让你在统一界面编辑，只有在你明确点击发布时才写回 —— 每次都会先展示 diff 预览，并自动创建备份。

| | |
|---|---|
| **扫描** | 检测已安装的 AI 工具，定位它们的配置目录 |
| **管理** | 在统一的 Monaco 编辑器界面编辑所有资产类型 |
| **预览** | 发布前，精确查看每个平台将接收到什么 |
| **发布** | 带有 dry-run、diff、自动备份和完整回滚的安全写入 |
| **同步** | 将整个环境推送到 Git，在任意机器上一键恢复 |
| **学习** | 捕获会话知识，从中生成 Rules 或 Skills |

---

## 三条设计原则

**卸载安全** — Prism 永远不持有你的文件。Rules、Skills、Agents、Hooks、MCP 配置都住在各自的 IDE 目录里，Prism 只持有元数据和索引。卸载 Prism 后所有文件完好无损。

**手动发布** — 编辑永不自动传播。每一次变更都要经过：预览 diff → 确认 → 写入。你决定改动何时、往哪儿落地。

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
| **MCP Servers** | 完整 CRUD · 表单编辑器 · 从 `settings.json` 扫描并导入 |
| **Hooks（钩子）** | 完整 CRUD · 表单编辑器 · 读写 `settings.json` hooks 字段 |

### Profile 与发布

将任意组合的 Rules、Skills、Agents、Commands、MCP Servers 和 Hooks 组合为一个 **Profile**，一次操作发布到一个或多个平台。

每次发布都会：
- 展示 **dry-run diff**，写入前你能看到完整变更
- 自动备份到 `~/.prism/backups/`
- 写入**版本历史记录**，随时通过"版本历史"标签页完整回滚

### 知识库

将 AI 会话中的收获结构化为知识条目，按领域和项目路径打标签。积累到一定量后，生成一条编码了你偏好的自定义 Rule 或 Skill，直接发布到 IDE。

支持**开发者档案**：记录你的姓名、角色、偏好技术栈和技能标签，让生成的资产真正反映你的工作风格。

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
│   ├── mcp/             IdeSettingsMcpStore → 读写 settings.json mcpServers 字段
│   ├── profiles/        FileProfileStore  → 读写 ~/.prism/profiles/
│   ├── publish/         PublishEngine     → dry-run · diff · 备份 · 版本历史
│   ├── git-sync/        GitSyncService    → 克隆 · 推拉 · 冲突检测
│   ├── knowledge/       KnowledgeStore    → 条目 · 开发者档案 · 资产生成
│   ├── registry/        RegistryStore     → 跨平台资产索引
│   └── watcher/         FileWatcher       → 检测外部配置变更
│
├── adapters/
│   ├── adapter-claude-code/   扫描 ~/.claude-internal（回退 ~/.claude）
│   ├── adapter-codebuddy/     扫描 ~/.codebuddy
│   └── adapter-openclaw/      扫描 ~/.openclaw
│
└── server/              Fastify API，将 Store 层接入 HTTP

apps/
└── web/                 React + Vite，Monaco 编辑器，中英文双语（i18n）
```

### 存储结构

```
~/.claude-internal/   ← Claude Code 配置（Prism 读取并向此发布）
~/.codebuddy/         ← Codebuddy 配置
~/.openclaw/          ← OpenClaw 配置
    ├── settings.json       mcpServers + hooks 字段
    ├── rules/*.md          YAML frontmatter + Markdown 正文
    ├── skills/*/SKILL.md
    ├── agents/*.md
    └── commands/*.md

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
               → 写入 ~/.claude-internal/rules/rule.md
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
pnpm typecheck        # 对全部 7 个包进行类型检查
pnpm lint             # ESLint
pnpm build            # 全量构建（Turbo 依赖顺序）

# 单独运行某个包
pnpm --filter @prism/server dev    # Fastify API on :3001
pnpm --filter @prism/web dev       # Vite 前端 on :5173
```

---

## 添加平台适配器

实现 `@prism/core` 中的 `PlatformAdapter` 接口，大约 50 行搞定：

```typescript
import type { PlatformAdapter } from '@prism/core'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

export const myToolAdapter: PlatformAdapter = {
  id: 'my-tool',
  displayName: 'My Tool',
  capabilities: { rules: true, skills: true, mcp: true, hooks: true },

  async scan() {
    const configPath = path.join(os.homedir(), '.mytool')
    const detected = await fs.access(configPath).then(() => true).catch(() => false)
    return {
      id: 'my-tool',
      displayName: 'My Tool',
      detected,
      configPath: detected ? configPath : undefined,
      capabilities: this.capabilities,
    }
  },
}
```

然后在 `packages/server/src/index.ts` 中注册它，完成。

---

## 参与贡献

目前最有价值的贡献方向：

- **新平台适配器** — Cursor、Copilot、Windsurf、Codex、OpenCode
- **投影逻辑** — 一条 Rule 如何映射到不同平台的具体格式？
- **知识生成** — 从会话历史自动生成资产的更智能启发式策略
- **测试夹具** — 来自不同工具的真实配置样本，用于集成测试

发送大型 PR 之前请先开 Issue。小而聚焦的 PR 合并更快。

---

## 许可证

[MIT](LICENSE) — 随便用，保留版权声明就行。

---

<div align="center">

为那些希望 AI 工具与自己协作、而非绕着自己走的开发者而建。

</div>
