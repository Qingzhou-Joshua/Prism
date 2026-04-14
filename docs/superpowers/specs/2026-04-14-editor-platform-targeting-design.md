# Editor Platform Targeting Redesign

**Date:** 2026-04-14  
**Scope:** RuleEditorPage, SkillEditorPage, AgentEditorPage  
**Status:** Approved

---

## Problem

The three editor pages (Rules, Skills, Agents) have three issues:
1. The left panel is too sparse — wasted whitespace with few fields
2. The right "Platform Projections" panel occupies a third of the screen but adds limited value for per-platform content variation (which is not needed)
3. Per-platform content overrides are not needed — same content applies to all platforms
4. Tags input is not useful in the current workflow and adds noise
5. Platform targeting uses a hardcoded `ALL_PLATFORMS` list instead of reflecting which platforms are actually installed on the user's machine

---

## Decision

Remove the 3-column layout. Restructure as 2-column: left metadata panel + center Monaco editor.

---

## Layout

```
┌─────────────────────┬────────────────────────────────────┐
│   LEFT (~260px)     │   CENTER (flex: 1)                 │
│                     │                                    │
│  Name               │                                    │
│  [other fields]     │   Monaco Editor (markdown)         │
│                     │                                    │
│  ─────────────────  │                                    │
│  Target Platforms   │                                    │
│  ☑ Apply to all     │                                    │
│  ─────────────────  │                                    │
│  ☑ claude-code  ◈   │                                    │
│  ☑ codebuddy    ◎   │                                    │
│  (detected only)    │                                    │
└─────────────────────┴────────────────────────────────────┘
```

---

## Changes per File

### `App.tsx`
- Derive `detectedPlatforms: PlatformScanResult[]` from `platforms.filter(p => p.detected)`
- Pass `detectedPlatforms` as prop to all three EditorPage components
- Pass it via `page` state when navigating to editor views, or directly as a prop to the rendered component

### `RuleEditorPage.tsx`
- Add `detectedPlatforms: PlatformScanResult[]` to `RuleEditorPageProps`
- Remove `ALL_PLATFORMS` import and hardcoded platform list — replace with `detectedPlatforms`
- Remove Tags input field and `tagsInput` state
- Remove right panel (`editor-right`) and `<ProjectionPreview>` component entirely
- Retain "Apply to all platforms" checkbox behavior:
  - Checked → all platform checkboxes are `checked + disabled`, save DTO gets `targetPlatforms: []`
  - Unchecked → checkboxes are interactive, default to all selected
- Remove `platformOverrides` logic (per-platform content variation is no longer supported)

### `SkillEditorPage.tsx`
- Add `detectedPlatforms: PlatformScanResult[]` to `SkillEditorPageProps`
- Add platform targeting UI (same as RuleEditor): "Apply to all" + per-platform checkboxes
- Add `applyGlobally` state (default: `true`)
- Add `targetPlatforms` state (default: all detected platform IDs)
- Remove `tagsInput` state and Tags input field
- Remove right panel and `<SkillProjectionPreview>` component entirely
- Save DTO: `targetPlatforms: applyGlobally ? [] : targetPlatforms`

### `AgentEditorPage.tsx`
- Add `detectedPlatforms: PlatformScanResult[]` to `AgentEditorPageProps`
- Add platform targeting UI (same pattern)
- Add `applyGlobally` and `targetPlatforms` states
- Remove `tagsInput` state and Tags input field
- Remove right panel and `<AgentProjectionPreview>` component entirely
- Save DTO: `targetPlatforms: applyGlobally ? [] : targetPlatforms`

### `styles.css`
- Remove or repurpose `.editor-right`, `.projection-panel`, `.proj-*` styles (can leave as dead CSS or clean up)
- Update `.editor-layout` grid: change from 3-column to 2-column (`editor-left` + `editor-center`)
- `editor-center` should `flex: 1` to fill remaining space
- Platform checkbox styles (`.platform-checkbox-row`, `.platform-dot`, `.platform-dot-${id}`) are already present — reuse them

---

## Data Flow

```
App.tsx
  platforms: PlatformScanResult[]          ← from GET /platforms
  detectedPlatforms = platforms.filter(p => p.detected)
      │
      ├─→ <RuleEditorPage   detectedPlatforms={detectedPlatforms} ... />
      ├─→ <SkillEditorPage  detectedPlatforms={detectedPlatforms} ... />
      └─→ <AgentEditorPage  detectedPlatforms={detectedPlatforms} ... />

EditorPage internal state:
  applyGlobally: boolean (default true)
  targetPlatforms: string[] (default: all detectedPlatforms IDs)

Save DTO:
  targetPlatforms: applyGlobally ? [] : targetPlatforms
```

---

## Left Panel Fields (per editor)

| Field            | RuleEditor | SkillEditor | AgentEditor |
|------------------|-----------|-------------|-------------|
| Name             | ✅         | ✅           | ✅           |
| Trigger          | —         | ✅           | —           |
| Category         | —         | ✅           | —           |
| Tags             | ❌ removed | ❌ removed   | ❌ removed   |
| Agent Type       | —         | —           | ✅           |
| Description      | —         | —           | ✅           |
| Platform picker  | ✅ updated | ✅ new       | ✅ new       |

---

## Platform Picker Behavior

- "Apply to all platforms" checkbox at the top of the section
  - Checked (default): all per-platform checkboxes are `checked` + `disabled` (greyed out visually)
  - Unchecked: per-platform checkboxes become interactive, all default to checked
- Only detected platforms (`p.detected === true`) are rendered
- Each row: colored dot + platform display name
- If no platforms are detected: show a small note "No platforms detected"

---

## Out of Scope

- Per-platform content overrides (different content per platform) — explicitly not supported
- Tags feature — removed entirely for now
- Platform Projections preview panel — removed entirely
