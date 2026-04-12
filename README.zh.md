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

**AI 工具配置的本地控制平面**

扫描 · 管理 · 预览 · 发布 — 统一管理你使用的每一款 AI 编程工具

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220.svg)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18.svg)](https://vitest.dev/)

[English](README.md) · 简体中文

</div>

---

## 问题所在

你同时使用 Claude Code、Cursor、OpenClaw 和 CodeBuddy。每一款工具都有自己的：

- 配置目录，藏在 `~/` 的某个角落
- 规则系统，语法各不相同
- Profile 概念，数据结构各有一套
- 发布机制，没有任何安全保障

结果就是：你的 AI 配置散落在 4 个不同的地方。规则靠复制粘贴来同步。根本不知道哪些配置实际生效。一个错误的编辑就能搞坏整个 Claude 设置，而你要等到对话进行到一半才发现。

**Prism 解决这个问题。**

---

## Prism 能做什么

Prism 是一个**本地控制平面** — 不是另一个 AI IDE，也不是 Agent 运行时。

它位于你所有 AI 工具的上层，提供：

| 能力 | 含义 |
|------|------|
| **扫描（Scan）** | 检测已安装的 AI 工具，定位它们的配置目录 |
| **管理（Manage）** | 在同一个地方编辑规则和 Profile |
| **预览（Preview）** | 发布之前，精确查看每个平台将收到什么 |
| **发布（Publish）** | 带有 dry-run、diff、备份和版本历史的安全写入 |

把它想象成 AI 配置的反向代理：一个数据源，多个平台目标。

---

## 当前状态：v0.1 扫描器 PoC ✅

```
┌─────────────────────────────────────────────────────────┐
│  ▲ Prism                                                 │
│  本地优先的 AI 配置控制平面                               │
│                                                          │
│  平台扫描器                     3/3 已检测  ↺ 重新扫描  │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │ OpenClaw  ✓     │  │ Claude Code ✓   │               │
│  │ ID: openclaw    │  │ ID: claude-code │               │
│  │ ~/.openclaw     │  │ ~/.claude-intl  │               │
│  │                 │  │                 │               │
│  │ Rules  Profiles │  │ Rules  Profiles │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                          │
│  ┌─────────────────┐                                     │
│  │ CodeBuddy ✓     │                                     │
│  │ ID: codebuddy   │                                     │
│  │ ~/.codebuddy    │                                     │
│  │                 │  │                 │               │
│  │ Rules  Profiles │                                     │
│  └─────────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

扫描器已上线。它会检测机器上真实的配置目录，检查规则子目录是否存在，并报告平台能力 — 全部通过本地 API 和 React 前端完成。

---

## 快速开始

**前置要求：** Node.js 20+、pnpm 9+

```bash
# 克隆并安装依赖
git clone https://github.com/yourusername/prism.git
cd prism
pnpm install

# 启动所有服务
pnpm dev
```

打开 **http://localhost:5173** — 你将看到 Prism 在你机器上检测到了哪些 AI 工具。

API 运行在 **http://localhost:3001**。

```bash
# 健康检查
curl http://localhost:3001/health

# 平台扫描结果
curl http://localhost:3001/platforms

# 触发重新扫描
curl -X POST http://localhost:3001/scan
```

---

## 架构

Prism 是一个 TypeScript monorepo，每一层职责单一：

```
packages/
├── shared/              # PlatformId、PlatformScanResult、PlatformCapabilities
│                          纯类型定义，零依赖
│
├── core/                # PlatformAdapter 接口 + AdapterRegistry
│                          scanPlatforms() 编排器，无 I/O
│
├── adapters/
│   ├── adapter-openclaw/    # 扫描 ~/.openclaw，检测 rules/ 目录
│   ├── adapter-codebuddy/   # 扫描 ~/.codebuddy
│   └── adapter-claude-code/ # 扫描 ~/.claude-internal，回退到 ~/.claude
│
├── server/              # Fastify API，将适配器接入 HTTP
│                          GET /health  GET /platforms  POST /scan
│
apps/
└── web/                 # React + Vite 前端，渲染扫描结果
```

**数据流：**

```
浏览器 → GET /platforms
  → server → AdapterRegistry.scanAll()
    → 每个适配器检查真实文件系统路径
      → PlatformScanResult[]
  ← { items: PlatformScanResult[] }
```

添加一个新的平台适配器只需约 50 行代码，一个文件搞定。

---

## 路线图

### ✅ v0.1 — 扫描器 PoC
平台检测、路径发现、能力概览，本地 API + 前端全部就绪。

### 🔜 v0.2 — 规则编辑器
统一规则模型、规则编辑器（Monaco）、各平台投影预览。

### 🔜 v0.3 — Profile PoC
Profile 组合、dry-run 发布计划、受影响文件预览。

### 🔜 v0.4 — MVP
带备份和版本历史的真实发布流程，完整支持 OpenClaw / Claude Code / Cursor。

### 🔮 v0.5+
诊断、项目绑定、技能管理、Agent 配置、治理与回滚。

---

## 开发

```bash
# 运行测试（23 个测试，5 个包）
pnpm test

# 全量类型检查
pnpm typecheck

# Lint
pnpm lint

# 构建
pnpm build

# 单独运行某个包
pnpm --filter @prism/server dev
pnpm --filter @prism/web dev
```

---

## 添加平台适配器

实现 `@prism/core` 中的 `PlatformAdapter` 接口：

```typescript
import type { PlatformAdapter } from '@prism/core'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

export const myToolAdapter: PlatformAdapter = {
  id: 'my-tool',
  displayName: 'My Tool',
  capabilities: { rules: true, profiles: false },

  async scan() {
    const configPath = path.join(os.homedir(), '.mytool')
    const detected = await fs.access(configPath).then(() => true).catch(() => false)

    return {
      id: 'my-tool',
      displayName: 'My Tool',
      detected,
      configPath: detected ? configPath : undefined,
      capabilities: { rules: true, profiles: false },
    }
  },
}
```

然后在 `packages/server/src/index.ts` 中注册它。就这些。

---

## 参与贡献

Prism 还处于早期阶段，迭代很快。目前最有价值的贡献方向：

- **新平台适配器** — Cursor、Copilot、Windsurf、Codex、OpenCode
- **规则模型设计** — 统一规则应该长什么样？
- **投影逻辑** — 一条规则如何映射到不同平台的格式？
- **发布安全机制** — 备份、diff 和版本跟踪的实现
- **测试夹具和测试数据** — 真实世界的配置样本用于集成测试

发送大型 PR 之前请先开 Issue。小而聚焦的 PR 合并更快。

---

## 许可证

[MIT](LICENSE) — 随便用，保留版权声明就行。

---

<div align="center">

由那些厌倦了在工具之间复制粘贴 AI 规则的开发者构建。

</div>
