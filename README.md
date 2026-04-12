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

**Local-first control plane for AI tool configuration**

Scan · Manage · Preview · Publish — across every AI coding tool you use

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220.svg)](https://pnpm.io/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18.svg)](https://vitest.dev/)

</div>

---

## The Problem

You use Claude Code, Cursor, OpenClaw, and CodeBuddy. Each one has its own:

- config directory buried somewhere in `~/`
- rule system with its own syntax
- profile concept with its own shape
- publish mechanism with no safety net

So your AI config lives in 4 different places. You copy-paste rules between tools. You have no idea what's actually active. One wrong edit breaks your entire Claude setup and you don't find out until mid-session.

**Prism fixes this.**

---

## What Prism Does

Prism is a **local control plane** — not another AI IDE, not an agent runtime.

It sits above your AI tools and gives you:

| Capability | What it means |
|-----------|---------------|
| **Scan** | Detect which AI tools are installed and where their configs live |
| **Manage** | Edit rules and profiles in one place |
| **Preview** | See exactly what each platform will receive before you publish |
| **Publish** | Write to disk with dry-run, diff, backup, and revision history |

Think of it like a reverse proxy for your AI configuration: one source of truth, many platform targets.

---

## Current Status: v0.1 Scanner PoC ✅

```
┌─────────────────────────────────────────────────────────┐
│  ▲ Prism                                                 │
│  Local-first AI config control plane                     │
│                                                          │
│  Platform Scanner               3/3 detected  ↺ Rescan  │
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
│  │                 │                                     │
│  │ Rules  Profiles │                                     │
│  └─────────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

The scanner is live. It detects real config directories on your machine, checks for rules subdirectories, and reports platform capabilities — all via a local API with a React frontend.

---

## Quick Start

**Prerequisites:** Node.js 20+, pnpm 9+

```bash
# Clone and install
git clone https://github.com/yourusername/prism.git
cd prism
pnpm install

# Start everything
pnpm dev
```

Open **http://localhost:5173** — you'll see which AI tools Prism detected on your machine.

The API runs on **http://localhost:3001**.

```bash
# Health check
curl http://localhost:3001/health

# Platform scan results
curl http://localhost:3001/platforms

# Trigger a fresh scan
curl -X POST http://localhost:3001/scan
```

---

## Architecture

Prism is a TypeScript monorepo. Each layer has a single responsibility:

```
packages/
├── shared/              # PlatformId, PlatformScanResult, PlatformCapabilities
│                          Pure types. Zero dependencies.
│
├── core/                # PlatformAdapter interface + AdapterRegistry
│                          scanPlatforms() orchestrator. No I/O.
│
├── adapters/
│   ├── adapter-openclaw/    # Scans ~/.openclaw, detects rules/
│   ├── adapter-codebuddy/   # Scans ~/.codebuddy
│   └── adapter-claude-code/ # Scans ~/.claude-internal, falls back to ~/.claude
│
├── server/              # Fastify API. Wires adapters → HTTP.
│                          GET /health  GET /platforms  POST /scan
│
apps/
└── web/                 # React + Vite frontend. Renders scan results.
```

**Data flow:**

```
Browser → GET /platforms
  → server → AdapterRegistry.scanAll()
    → each adapter checks real fs paths
      → PlatformScanResult[]
  ← { items: PlatformScanResult[] }
```

Adding a new platform adapter takes ~50 lines and one file.

---

## Roadmap

### ✅ v0.1 — Scanner PoC
Platform detection, path discovery, capability overview, live API + frontend.

### 🔜 v0.2 — Rule Editor
Unified rule model, rule editor (Monaco), projection preview per platform.

### 🔜 v0.3 — Profile PoC
Profile composition, dry-run publish plan, affected file preview.

### 🔜 v0.4 — MVP
Real publish flow with backup + revision history. Full OpenClaw / Claude Code / Cursor support.

### 🔮 v0.5+
Diagnostics, project binding, skills management, agent config, governance + rollback.

---

## Development

```bash
# Run tests (23 tests, 5 packages)
pnpm test

# Type check all packages
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build

# Run a single package
pnpm --filter @prism/server dev
pnpm --filter @prism/web dev
```

---

## Adding a Platform Adapter

Implement the `PlatformAdapter` interface from `@prism/core`:

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

Then register it in `packages/server/src/index.ts`. That's it.

---

## Contributing

Prism is early-stage and moving fast. The most valuable contributions right now:

- **New platform adapters** — Cursor, Copilot, Windsurf, Codex, OpenCode
- **Rule model design** — What should a unified rule look like?
- **Projection logic** — How should one rule map to different platform formats?
- **Publish safety** — Backup, diff, and revision tracking mechanisms
- **Fixtures and test data** — Real-world config samples for integration testing

Open an issue before sending a large PR. Small, focused PRs merge faster.

---

## License

[MIT](LICENSE) — do whatever you want, just keep the copyright notice.

---

<div align="center">

Built by developers who got tired of copy-pasting AI rules between tools.

</div>
