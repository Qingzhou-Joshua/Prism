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

**The control plane for your AI coding environment.**

One interface to manage Rules, Skills, Agents, MCP Servers, Hooks, and Commands
across every AI coding tool you use — without touching their config files directly.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/version-0.10.1-orange.svg)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220.svg)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18.svg)](https://vitest.dev/)

English · [简体中文](README.zh.md)

</div>

---

## The Problem

You use Claude Code, Codebuddy, OpenClaw, and more. Each one has its own config directory buried somewhere in `~/`, its own rule syntax, its own MCP format. When something breaks, you have no idea which file to edit. When you want to try a new tool, you're copy-pasting rules by hand.

**Your AI environment is scattered. Prism unifies it.**

---

## What Prism Does

Prism is a **local control plane for Harness Engineering** — the practice of designing the environment that makes AI agents work reliably:

1. **Environment Design** — Rules, Skills, Agents that shape agent behavior
2. **Tool Integration** — MCP Servers and Commands that extend agent capabilities  
3. **Feedback Mechanisms** — Hooks and evaluators that keep agents on track

Prism never touches your IDE config directly. It reads from your IDE directories, lets you edit in one place, and only writes back when you explicitly publish — with a diff preview and an automatic backup every time.

| | |
|---|---|
| **Scan** | Detect which AI tools are installed and where their configs live |
| **Manage** | Edit all asset types in a unified Monaco-powered interface |
| **Preview** | See exactly what each platform will receive before you publish |
| **Publish** | Write to disk with dry-run, diff, automatic backup, and full rollback |
| **Sync** | Push your entire environment to Git and pull it on any machine |
| **Learn** | Capture session knowledge and generate Rules or Skills from it |

---

## Three Design Principles

**Unload Safety** — Prism never owns your files. Rules, Skills, Agents, Hooks, and MCP configs live in their IDE directories. Prism holds only metadata and indexes. Uninstalling Prism leaves everything intact.

**Manual Publish** — Edits never auto-propagate. Every change goes through: preview diff → confirm → write. You decide when and where your config changes land.

**File First** — The IDE directories are the source of truth. Prism detects changes there and prompts you to sync. The file system wins, always.

---

## Features

### Asset Management

| Asset | Capabilities |
|-------|-------------|
| **Rules** | Full CRUD · Monaco editor · per-platform projection preview · import from IDE dirs |
| **Skills** | Full CRUD · Monaco editor · per-platform projection preview · import from IDE dirs |
| **Agents** | Full CRUD · Monaco editor · per-platform projection preview · import from IDE dirs |
| **Commands** | Full CRUD · Monaco editor |
| **MCP Servers** | Full CRUD · form editor · scan & import from `settings.json` |
| **Hooks** | Full CRUD · form editor · read/write to `settings.json` hooks field |

### Profiles & Publishing

Compose any combination of Rules, Skills, Agents, Commands, MCP Servers, and Hooks into a **Profile**, then publish it to one or more platforms in a single operation.

Every publish:
- shows a **dry-run diff** before writing anything
- creates an **automatic backup** to `~/.prism/backups/`
- records a **revision entry** for full rollback via the Revisions tab

### Knowledge Base

Capture what you learn from AI sessions as structured knowledge entries. Tag them by domain and project path. When you have enough entries, generate a custom Rule or Skill that encodes your preferences — and publish it directly to your IDE.

Supports **developer profiles**: your name, role, preferred stack, and skill tags — so generated assets reflect your actual working style.

### Git Sync

Your AI environment is code. Treat it that way.

- Initialize a Git repo around your `~/.prism/` directory
- Push your entire config (rules, skills, agents, MCP, hooks, knowledge) as a portable export package
- Pull on any other machine and restore everything in one operation
- **Conflict resolution UI** when local and remote diverge — pick theirs, keep yours, or merge manually

### File Watcher

Prism watches your IDE config directories for external changes (edits made directly in Claude Code, etc.) and surfaces a banner when drift is detected, so your Prism view stays accurate.

---

## Quick Start

**Prerequisites:** Node.js 20+, pnpm 9+

```bash
git clone https://github.com/yourusername/prism.git
cd prism
pnpm install
pnpm dev
```

- Frontend: **http://localhost:5173**
- API: **http://localhost:3001**

```bash
# Verify the API is running
curl http://localhost:3001/health

# See which AI tools Prism detected
curl http://localhost:3001/platforms

# Trigger a fresh scan
curl -X POST http://localhost:3001/scan
```

---

## Architecture

Prism is a TypeScript monorepo. Each layer has a single responsibility:

```
packages/
├── shared/              Pure types. Zero dependencies.
│                        (PlatformId, UnifiedRule, UnifiedSkill, Profile,
│                         GitSyncConfig, KnowledgeEntry, GeneratedAsset, ...)
│
├── core/                Business logic. No HTTP dependency.
│   ├── rules/           DirRuleStore      → reads/writes ~/.{ide}/rules/
│   ├── skills/          DirSkillStore     → reads/writes ~/.{ide}/skills/
│   ├── agents/          DirAgentStore     → reads/writes ~/.{ide}/agents/
│   ├── commands/        DirCommandStore   → reads/writes ~/.{ide}/commands/
│   ├── hooks/           FileHookStore     → reads/writes settings.json hooks field
│   ├── mcp/             IdeSettingsMcpStore → reads/writes settings.json mcpServers field
│   ├── profiles/        FileProfileStore  → reads/writes ~/.prism/profiles/
│   ├── publish/         PublishEngine     → dry-run · diff · backup · revision
│   ├── git-sync/        GitSyncService    → clone · push · pull · conflict detection
│   ├── knowledge/       KnowledgeStore    → entries · developer profile · asset generation
│   ├── registry/        RegistryStore     → asset index for cross-platform awareness
│   └── watcher/         FileWatcher       → detects external config changes
│
├── adapters/
│   ├── adapter-claude-code/   Scans ~/.claude-internal (fallback ~/.claude)
│   ├── adapter-codebuddy/     Scans ~/.codebuddy
│   └── adapter-openclaw/      Scans ~/.openclaw
│
└── server/              Fastify API. Wires stores → HTTP.

apps/
└── web/                 React + Vite. Monaco editor. i18n (EN/ZH).
```

### Storage Layout

```
~/.claude-internal/   ← Claude Code config (Prism reads and publishes here)
~/.codebuddy/         ← Codebuddy config
~/.openclaw/          ← OpenClaw config
    ├── settings.json       mcpServers + hooks
    ├── rules/*.md          YAML frontmatter + Markdown body
    ├── skills/*/SKILL.md
    ├── agents/*.md
    └── commands/*.md

~/.prism/             ← Prism's own data (metadata and indexes only)
    ├── profiles/profiles.json
    ├── knowledge/
    ├── git-sync/
    ├── backups/{revisionId}/
    └── revisions/
```

### Data Flow

```
Browser  →  PUT /rules/:id
              → DirRuleStore.update()
                → writes ~/.claude-internal/rules/rule.md
                → updates registry index

Browser  →  POST /profiles/:id/publish
              → PublishEngine.publish()
                → backup existing files to ~/.prism/backups/
                → write rules/skills/agents/mcp/hooks to target platform dirs
                → record Revision entry for rollback

Browser  →  POST /git-sync/push
              → GitSyncService.push()
                → serialize registry + overrides + knowledge → export package
                → git add · commit · push to remote
```

---

## Development

```bash
pnpm dev              # Start all packages in parallel (API + frontend)
pnpm test             # Run all unit tests (Vitest)
pnpm typecheck        # Type-check all 7 packages
pnpm lint             # ESLint
pnpm build            # Full build (Turbo dependency order)

# Run individual packages
pnpm --filter @prism/server dev    # Fastify API on :3001
pnpm --filter @prism/web dev       # Vite frontend on :5173
```

---

## Adding a Platform Adapter

Implement `PlatformAdapter` from `@prism/core` — takes about 50 lines:

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

Register it in `packages/server/src/index.ts`. That's it.

---

## Contributing

The most valuable contributions right now:

- **New platform adapters** — Cursor, Copilot, Windsurf, Codex, OpenCode
- **Projection logic** — How should one Rule map to different platform formats?
- **Knowledge generation** — Smarter heuristics for auto-generating assets from session history
- **Test fixtures** — Real-world config samples from different tools for integration testing

Open an issue before sending a large PR. Small, focused PRs merge faster.

---

## License

[MIT](LICENSE) — do whatever you want, just keep the copyright notice.

---

<div align="center">

Built for developers who want their AI tools to work with them, not around them.

</div>
