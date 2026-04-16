# Hooks Management — Design Spec

**Date:** 2026-04-16  
**Status:** Approved

## Overview

Add a Hooks tab to Prism, enabling users to view and manage Claude Code / CodeBuddy lifecycle hooks stored in `~/.claude-internal/hooks/hooks.json` and `~/.codebuddy/hooks/hooks.json`.

Hooks are read from and written back to the platform's `hooks/hooks.json` file. The on-disk format (nested by event type, compatible with Claude Code natively) is preserved at all times.

---

## 1. Data Model

### New file: `packages/shared/src/hook.ts`

```typescript
export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'SubagentStart'
  | 'SubagentStop'

export interface HookCommand {
  type: 'command'
  command: string
  timeout?: number
}

export interface HookHttp {
  type: 'http'
  url: string
  method?: string
  headers?: Record<string, string>
  timeout?: number
}

export interface HookPrompt {
  type: 'prompt'
  prompt: string
}

export interface HookAgent {
  type: 'agent'
  agent: string
}

export type HookAction = HookCommand | HookHttp | HookPrompt | HookAgent

// One hook entry — corresponds to one { matcher, hooks[], description, id } object in hooks.json
export interface UnifiedHook {
  id: string
  eventType: HookEventType
  matcher: string
  description?: string
  actions: HookAction[]   // maps to hooks[] in the raw file
  platformId: string
  createdAt: string
  updatedAt: string
}

export interface CreateHookDto {
  eventType: HookEventType
  matcher: string
  description?: string
  actions: HookAction[]
}

export interface UpdateHookDto {
  eventType?: HookEventType
  matcher?: string
  description?: string
  actions?: HookAction[]
}
```

### Serialization contract

- **Read**: parse `{ hooks: { [EventType]: Entry[] } }` → flatten into `UnifiedHook[]`, injecting `eventType` from the key. Since `hooks.json` has no timestamps, `createdAt`/`updatedAt` are set to the file's `mtime` for existing entries on first read; on create/update they are set to `new Date().toISOString()`.
- **Write**: group `UnifiedHook[]` by `eventType` → reconstruct original nested structure (omit `createdAt`/`updatedAt`/`platformId` from the written JSON to stay native-compatible) → write back to file.

This ensures the file stays compatible with Claude Code's native hooks format at all times.

---

## 2. Backend

### Store interface + implementation

**`packages/core/src/hooks/store.ts`**

```typescript
export interface HookStore {
  list(): Promise<UnifiedHook[]>
  get(id: string): Promise<UnifiedHook | null>
  create(dto: CreateHookDto): Promise<UnifiedHook>
  update(id: string, dto: UpdateHookDto): Promise<UnifiedHook | null>
  delete(id: string): Promise<boolean>
}
```

`FileHookStore` reads the JSON file on every `list()` call and writes the full file on every mutating call. IDs are generated as `uuid` on creation (or preserved from existing entries that already have an `id` field).

### HTTP routes

**`packages/server/src/routes/hooks.ts`**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/hooks` | List all hooks; supports `?platform=` query param |
| POST | `/hooks` | Create a new hook entry |
| GET | `/hooks/:id` | Get single hook by id |
| PUT | `/hooks/:id` | Update a hook entry |
| DELETE | `/hooks/:id` | Delete a hook entry |

### Platform capability extension

`PlatformCapabilities` in `packages/shared/src/index.ts` gains a `hooks: boolean` field.

Both `adapter-claude-code` and `adapter-codebuddy` check whether `hooks/hooks.json` exists at their respective config paths; if present, they set `hooks: true` in the scan result.

### Server wiring (`packages/server/src/index.ts`)

```typescript
function getPlatformHooksPath(id: PlatformId): string {
  const base = id === 'claude-code' ? '~/.claude-internal' : `~/.${id}`
  return path.join(expandHome(base), 'hooks', 'hooks.json')
}

const HOOKS_PLATFORM_IDS: PlatformId[] = ['claude-code', 'codebuddy']
const hooksStores = new Map(
  HOOKS_PLATFORM_IDS.map(id => [id, new FileHookStore(getPlatformHooksPath(id))])
)
await registerHooksRoutes(app, hooksStores)
```

---

## 3. Frontend

### App.tsx changes

```typescript
// Extend capability type
type Capability = 'rules' | 'skills' | 'agents' | 'mcp' | 'hooks'

// Add to CAPABILITY_CONFIG
hooks: { label: 'Hooks', icon: '🪝', defaultPage: 'hooks-list' }

// Add to Page union
| { name: 'hooks-list'; platformId: string }
| { name: 'hook-editor'; platformId: string; hookId?: string }
```

`getPlatformCapabilities()` checks `platform.capabilities.hooks` to show/hide the Hooks tab.

### HooksPage (`apps/web/src/pages/HooksPage.tsx`)

- Fetches `GET /hooks?platform={platformId}`
- Groups results by `eventType`
- Renders one collapsible section per event type (PreToolUse, PostToolUse, Stop, etc.)
- Each hook entry shown as a card: **matcher** (bold), **description** (subtitle), **actions count** badge
- Each card has Edit and Delete icon buttons
- Page header has a "New Hook" button → navigates to `hook-editor` page (no hookId = create mode)

### HookEditorPage (`apps/web/src/pages/HookEditorPage.tsx`)

Operates in two modes: **create** (no `hookId`) and **edit** (with `hookId` → prefills form via `GET /hooks/:id`).

Form fields:

| Field | Control | Notes |
|-------|---------|-------|
| Event Type | `<select>` | PreToolUse / PostToolUse / Stop / SessionStart / SessionEnd / UserPromptSubmit / SubagentStart / SubagentStop |
| Matcher | `<input text>` | Tool name pattern, e.g. `Bash`, `.*` |
| Description | `<input text>` | Optional |
| Actions | Dynamic list | Add / remove individual actions |

Each action in the list:
- **Type** selector: command / http / prompt / agent
- **command**: `command` (textarea) + `timeout` (number, optional)
- **http**: `url` (text) + `method` (text, default GET) + `headers` (key-value pair list) + `timeout` (number, optional)
- **prompt**: `prompt` (textarea)
- **agent**: `agent` (text)

Footer: **Save** (POST or PUT) and **Cancel** buttons.

---

## 4. File Change Summary

| Package | Files Added | Files Modified |
|---------|-------------|----------------|
| `packages/shared` | `src/hook.ts` | `src/index.ts` (export hook types, add `hooks` to `PlatformCapabilities`) |
| `packages/core` | `src/hooks/store.ts`, `src/hooks/file-store.ts`, `src/hooks/index.ts` | `src/index.ts` (export hooks) |
| `packages/server` | `src/routes/hooks.ts` | `src/index.ts` (wire stores + routes) |
| `adapter-claude-code` | — | `src/index.ts` (detect hooks, set capability) |
| `adapter-codebuddy` | — | `src/index.ts` (detect hooks, set capability) |
| `apps/web` | `src/pages/HooksPage.tsx`, `src/pages/HookEditorPage.tsx` | `src/App.tsx` |

---

## 5. Out of Scope

- Projections endpoint (`GET /hooks/:id/projections`) — not needed for hooks
- Hook ordering / drag-and-drop reordering within an event group
- Import/export of hooks across platforms
- Real-time file watching (hooks are loaded on each API call)
