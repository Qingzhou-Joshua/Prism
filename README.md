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

One interface to manage Rules, Skills, Agents, MCP Servers, Plugins, Hooks, and Commands
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

You use Claude Code, CodeBuddy, Cursor, Codex, OpenCode, and more. Each one has its own config directory buried somewhere in `~/`, its own rule syntax, its own MCP format. When something breaks, you have no idea which file to edit. When you want to try a new tool, you're copy-pasting rules by hand.

**Your AI environment is scattered. Prism unifies it.**

---

## What Prism Does

Prism is a **local control plane for Harness Engineering** — the practice of designing the environment that makes AI agents work reliably:

1. **Environment Design** — Rules, Skills, Agents that shape agent behavior
2. **Tool Integration** — MCP Servers and Commands that extend agent capabilities  
3. **Feedback Mechanisms** — Hooks and evaluators that keep agents on track

Prism reads assets straight from each tool's own directories and config files and lets you manage them in one place. Editing an asset (save, delete, toggle a plugin) writes to that tool's file **immediately**, changing only what you edited. Publishing a **Profile** across platforms is the deliberate path: dry-run diff, automatic backup, and rollback.

| | |
|---|---|
| **Scan** | Detect which AI tools are installed (every `~/.*claude*` dir, CodeBuddy, Cursor, Codex, OpenCode) and where their configs live |
| **Manage** | Edit all asset types in a unified Monaco-powered interface |
| **Preview** | See exactly what each platform will receive before you publish |
| **Publish** | Write to disk with dry-run, diff, automatic backup, and full rollback |
| **Sync** | Push your entire environment to Git and pull it on any machine |

---

## Three Design Principles

**Unload Safety** — Prism never owns your files. Rules, Skills, Agents, Hooks, and MCP configs live in their IDE directories. Prism holds only metadata and indexes. Uninstalling Prism leaves everything intact.

**Direct Edit, Deliberate Publish** — Editing an asset writes to its own file right away (keeping unrelated fields and comments intact) — there is no preview or backup for single edits. Pushing a set of assets to other platforms goes through a Profile: preview diff → confirm → write, with an automatic backup and a revision you can roll back. Nothing is ever copied to another platform unless you publish it.

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
| **MCP Servers** | Full CRUD · stdio / http / sse · read/write each tool's native config (JSON, JSONC, TOML) · import from another platform |
| **Hooks** | Full CRUD · form editor · read/write to `settings.json` hooks field |
| **Plugins** | List installed plugins with their contents (skills / agents / commands / MCP / hooks) · enable / disable |

Edits keep each file's native front matter (`globs`, `alwaysApply`, `allowed-tools`, …), extension, and unrelated config keys/comments intact.

List pages show each asset's **description as a summary** and are searchable. Assets contributed by plugins appear **below your own**, one collapsed, read-only group per plugin — filter by source, search across all of them, and open any item in a read-only viewer. The sidebar shows counts as `own +plugin`.

### Supported Platforms

| Platform | Location | Rules | Skills | Agents | Commands | MCP | Hooks | Plugins |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Claude Code** | every `~/.*claude*` config dir (e.g. `~/.claude`, `~/.tclaude`) + `CLAUDE_CONFIG_DIR` — one instance each | ✓ | ✓ | ✓ | ✓ | ✓ `.claude.json` | ✓ | ✓ toggle |
| **CodeBuddy** | `~/.codebuddy` | ✓ `.mdc` | ✓ | ✓ | ✓ | ✓ `mcp.json` | ✓ | ✓ toggle |
| **Cursor** | `~/.cursor` | ✓ | ✓ | ✓ | ✓ | ✓ `mcp.json` | — | read-only |
| **Codex** | `~/.codex` (`CODEX_HOME`) | — | ✓ | — | ✓ prompts | ✓ `config.toml` | — | ✓ toggle |
| **OpenCode** | `~/.config/opencode` | — | ✓ | ✓ | ✓ | ✓ `opencode.json(c)` | — | read-only |

Only tools that are actually installed show up; the sidebar only lists what each platform supports.

### Profiles & Publishing

Compose any combination of Rules, Skills, Agents, Commands, MCP Servers, and Hooks into a **Profile**, then publish it to one or more platforms in a single operation.

Every publish:
- shows a **dry-run diff** before writing anything
- creates an **automatic backup** to `~/.prism/backups/`
- records a **revision entry** for full rollback via the Revisions tab

### Knowledge Base (hidden)

Capturing session knowledge and generating Rules/Skills from it is **temporarily hidden from the UI** while the capture pipeline is reworked (the `Stop` hook delivers a `transcript_path`, not the transcript itself). The API and data under `~/.prism/knowledge/` are kept.

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
│   ├── mcp/             NativeMcpStore    → each platform's native MCP config (JSON/JSONC/TOML)
│   ├── plugins/         PluginStore       → list installed plugins, enable/disable
│   ├── platforms/       discovery         → ~/.*claude* wildcard + CodeBuddy/Cursor/Codex/OpenCode
│   ├── profiles/        FileProfileStore  → reads/writes ~/.prism/profiles/
│   ├── publish/         PublishEngine     → dry-run · diff · backup · revision
│   ├── git-sync/        GitSyncService    → clone · push · pull · conflict detection
│   ├── knowledge/       KnowledgeStore    → entries · developer profile · asset generation
│   ├── registry/        RegistryStore     → asset index for cross-platform awareness
│   └── watcher/         FileWatcher       → detects external config changes
│
└── server/              Fastify API. Wires stores → HTTP.

apps/
└── web/                 React + Vite. Monaco editor. i18n (EN/ZH).
```

### Storage Layout

```
~/.claude/ ~/.tclaude/ …   ← Claude Code (every ~/.*claude* config dir is an instance)
    ├── rules/ skills/ agents/ commands/
    ├── settings.json        hooks + enabledPlugins
    └── plugins/installed_plugins.json
~/.claude.json              ← MCP for the ~/.claude instance (others: <dir>/.claude.json)
~/.codebuddy/               ← CodeBuddy: rules/*.mdc, skills, agents, commands, mcp.json, settings.json
~/.cursor/                  ← Cursor: rules, skills, agents, commands, mcp.json, plugins/cache
~/.codex/                   ← Codex: skills, prompts, config.toml (mcp_servers + plugins)
~/.config/opencode/         ← OpenCode: agents, commands, skills, opencode.json(c) (mcp + plugin)

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
                → writes ~/.claude/rules/rule.md (in place, native front matter kept)
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
pnpm typecheck        # Type-check all 4 packages (shared, core, server, web)
pnpm lint             # ESLint
pnpm build            # Full build (Turbo dependency order)

# Run individual packages
pnpm --filter @prism/server dev    # Fastify API on :3001
pnpm --filter @prism/web dev       # Vite frontend on :5173
```

### E2E tests (Playwright)

E2E tests create, edit and delete real config entries, so **never run them against your own HOME**. Start the API with a sandbox HOME that contains copies of your configs, then point the tests at it:

```bash
HOME=/tmp/prism-e2e-home pnpm --filter @prism/server dev   # unset CLAUDE_CONFIG_DIR / CODEX_HOME too
pnpm --filter @prism/web dev
PRISM_E2E_HOME=/tmp/prism-e2e-home npx playwright test
```

`tests/platforms-mcp-plugins.spec.ts` refuses to run if the API isn't using the sandbox HOME.

---

## Adding a Platform

Platforms are described declaratively in `packages/core/src/platforms/instances.ts`.
Add a `build<Tool>Instance()` that returns where the tool keeps each asset type
(rules/skills/agents/commands dirs, MCP config path + dialect, plugin source, hooks
settings file — `null` for unsupported), then detect it in `discoverPlatformInstances()`.
The server and UI pick it up automatically.

---

## Contributing

The most valuable contributions right now:

- **New platforms** — Copilot, Windsurf, Gemini CLI, Kiro (see *Adding a Platform*)
- **Projection logic** — How should one Rule map to different platform formats?
- **Knowledge capture** — Read the session transcript from `transcript_path` and summarize it properly
- **Test fixtures** — Real-world config samples from different tools for integration testing

Open an issue before sending a large PR. Small, focused PRs merge faster.

---

## License

[MIT](LICENSE) — do whatever you want, just keep the copyright notice.

---

<div align="center">

Built for developers who want their AI tools to work with them, not around them.

</div>
