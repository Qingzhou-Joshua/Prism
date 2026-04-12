# Prism

Prism is a local-first control plane for managing AI tool configurations across multiple platforms.

It helps developers **scan, manage, preview, and selectively publish** shared AI configuration assets such as rules and profiles to tools like OpenClaw, Claude Code, and Cursor.

---

## Why Prism?

Heavy AI-tool users often maintain similar configuration assets across multiple platforms:

- OpenClaw
- Claude Code
- Cursor
- CodeBuddy
- Codex
- OpenCode

Each platform has its own:
- config paths
- file formats
- rule systems
- profile concepts
- extension mechanisms

This leads to several problems:

- configuration is scattered
- reuse is difficult
- selective publishing is painful
- changes are hard to visualize
- publishing can accidentally break working setups

Prism exists to solve that.

---

## Core Idea

Prism is **not** another AI IDE or agent runtime.

It is a:

> **Local control plane for AI environment configuration**

Its job is to make multi-platform AI setups:
- visible
- structured
- previewable
- selectively publishable

---

## MVP Scope

Prism MVP focuses on:

### Platforms
- OpenClaw
- Claude Code
- Cursor

### Asset Types
- Rules
- Profiles

### Core Actions
- Scan
- Edit
- Preview
- Publish
- Diff

---

## Key Product Principles

### 1. Local-first
Everything runs locally by default.

### 2. Selective publish first
Unified management does **not** mean forced sync to all platforms.

### 3. Minimal shared abstraction
Prism uses a minimal common model plus platform-specific extensions.

### 4. Safe publishing
Preview, diff, backup, and revision tracking are first-class requirements.

---

## Version Roadmap

### v0.1.0 — Scanner PoC
- platform detection
- path discovery
- capability overview

### v0.2.0 — Rule PoC
- unified rule model
- rule editor
- platform projection preview

### v0.3.0 — Profile PoC
- profile composition
- dry-run publish plan
- affected file preview

### v0.4.0 — MVP
- real publish flow
- revision history
- OpenClaw / Claude Code / Cursor support

### v0.5+
- diagnostics
- project binding
- skills alpha
- agents alpha
- governance and rollback

---

## Proposed Monorepo Structure

```text
prism/
├─ apps/
│  ├─ web/
│  ├─ desktop/
│  └─ cli/
├─ packages/
│  ├─ core/
│  ├─ server/
│  ├─ storage/
│  ├─ shared/
│  ├─ projection/
│  ├─ publish/
│  ├─ adapters/
│  │  ├─ adapter-openclaw/
│  │  ├─ adapter-claude-code/
│  │  ├─ adapter-cursor/
│  │  └─ adapter-codebuddy/
│  └─ ui-kit/
├─ docs/
├─ fixtures/
├─ tests/
├─ README.md
└─ prism-prd.md
```

---

## Tech Stack Suggestion

### Backend
- Node.js
- TypeScript
- Fastify

### Frontend
- React
- Vite
- Tailwind CSS
- Zustand
- Monaco Editor

### Storage
- SQLite (preferred)
- JSON files for PoC stage

---

## First Build Order

Recommended implementation order:

1. monorepo bootstrap
2. adapter interface
3. platform scan flow
4. overview UI
5. rule model + storage
6. projection preview
7. profile model
8. dry-run publish plan
9. real publish with backup/revision

---

## Current Status

This repository is currently in planning / architecture stage.

Prepared documents:
- `prism-prd.md`
- `README.md`
- `issues.md`

---

## Contributing

Early contributors will be most useful in these areas:

- platform adapters
- projection rules
- publish safety mechanisms
- diff / revision UI
- documentation and fixtures

---

## License

TBD
