# Prism 快速参考手册

## 🎯 核心概念

**Prism** = AI 配置本地控制平面
- 扫描 3 个平台 (Claude Code, OpenClaw, CodeBuddy)
- 统一管理规则 (UnifiedRule)
- 聚合成配置包 (Profile)
- 按平台发布并追踪 (Revision)

---

## 📋 类型 - 一页速查

### Platform 相关
```ts
type PlatformId = 'openclaw' | 'claude-code' | 'cursor' | 'codebuddy'

interface PlatformScanResult {
  id: PlatformId
  displayName: string           // "Claude Code", "OpenClaw" 等
  detected: boolean             // 配置目录是否存在
  configPath?: string           // ~/.claude-internal 等
  rulesDetected?: boolean       // rules/ 子目录是否存在
  capabilities: PlatformCapabilities
}

interface ImportableRule {
  name: string      // 从 fileName 派生："common-coding-style.md" → "common coding style"
  content: string   // 文件完整内容
  fileName: string  // 原始文件名
}
```

### Rule 相关
```ts
interface UnifiedRule {
  id: string
  name: string
  content: string
  scope: 'global' | 'project'
  tags: string[]
  platformOverrides: Record<PlatformId, { content: string | null }>
  createdAt: string    // ISO 8601
  updatedAt: string
}

// 创建/更新 DTO 都是可选字段
interface CreateRuleDto { name, content, scope, tags?, platformOverrides? }
interface UpdateRuleDto { name?, content?, scope?, tags?, platformOverrides? }
```

### Profile 相关
```ts
interface Profile {
  id: string
  name: string
  ruleIds: string[]             // 绑定的 UnifiedRule.id 集合
  targetPlatforms: PlatformId[] // 目标发布平台
  createdAt: string
  updatedAt: string
}

interface PublishPreview {
  profileId: string
  files: PublishPreviewFile[]  // 每条规则在每个平台的预期输出
}

interface PublishPreviewFile {
  platformId: PlatformId
  ruleId: string
  ruleName: string
  fileName: string
  filePath: string             // 将写入的位置
  content: string | null       // projection 后的内容
  fileExists: boolean
}
```

### Revision 相关
```ts
interface Revision {
  id: string          // nanoid，也是 backup 子目录名
  profileId: string
  profileName: string
  publishedAt: string // ISO 8601
  files: PublishedFile[]
}

interface PublishedFile {
  platformId: PlatformId
  filePath: string    // 实际写入的绝对路径
  backupPath?: string // 如果是更新，备份路径
  isNew: boolean      // 发布前文件是否存在
  ruleId: string
  ruleName: string
}
```

---

## 🔌 API 端点速查

### Platform 扫描
```
GET  /health                    ✓ 健康检查
GET  /platforms                 ✓ 获取所有平台扫描结果
POST /scan                      ✓ 重新扫描所有或单个平台
```

### Rules CRUD
```
GET    /rules                   ✓ 列出所有规则
POST   /rules                   ✓ 创建规则 (body: CreateRuleDto)
GET    /rules/:id               ✓ 获取单条规则
PUT    /rules/:id               ✓ 更新规则 (body: UpdateRuleDto)
DELETE /rules/:id               ✓ 删除规则
GET    /rules/:id/projections   ✓ 获取单条规则的各平台 projection
```

### Platform Rules Import
```
GET /platforms/:id/rules        ✓ 获取某平台的可导入规则列表
                                  返回: { platformId, items: ImportableRule[] }
```

### Profiles CRUD
```
GET    /profiles                ✓ 列出所有 Profile
POST   /profiles                ✓ 创建 Profile (body: CreateProfileDto)
GET    /profiles/:id            ✓ 获取单条 Profile
PUT    /profiles/:id            ✓ 更新 Profile (body: UpdateProfileDto)
DELETE /profiles/:id            ✓ 删除 Profile
```

### Publish & Revisions
```
GET  /profiles/:id/preview      ✓ 获取发布预览 (returns PublishPreview)
POST /profiles/:id/publish      ✓ 执行发布 (returns { revision: Revision })

GET  /revisions                 ✓ 列出所有发布记录
GET  /revisions/:id             ✓ 获取单条发布记录
POST /revisions/:id/rollback    ✓ 执行回滚
```

---

## 🛠️ 前端 API 客户端速查

### rulesApi (apps/web/src/api/rules.ts)
```ts
rulesApi.list()
  → Promise<UnifiedRule[]>

rulesApi.get(id)
  → Promise<UnifiedRule | null>

rulesApi.create(dto: CreateRuleDto)
  → Promise<UnifiedRule>

rulesApi.update(id, dto: UpdateRuleDto)
  → Promise<UnifiedRule>

rulesApi.delete(id)
  → Promise<void>

rulesApi.projections(id)
  → Promise<RuleProjectionItem[]>
  // RuleProjectionItem = { platformId, content }
```

### profilesApi (apps/web/src/api/profiles.ts)
```ts
profilesApi.list()
  → Promise<Profile[]>

profilesApi.get(id)
  → Promise<Profile | null>

profilesApi.create(dto: CreateProfileDto)
  → Promise<Profile>

profilesApi.update(id, dto: UpdateProfileDto)
  → Promise<Profile>

profilesApi.delete(id)
  → Promise<void>

profilesApi.preview(id)
  → Promise<PublishPreview>

profilesApi.publish(id)
  → Promise<{ revision: Revision }>
```

### fetchPlatformRules (apps/web/src/api/platformRules.ts)
```ts
fetchPlatformRules(platformId: string)
  → Promise<ImportableRule[]>
  // GET /platforms/:id/rules
```

### revisionsApi (apps/web/src/api/revisions.ts)
```ts
revisionsApi.list()
  → Promise<Revision[]>

revisionsApi.get(id)
  → Promise<Revision | null>

revisionsApi.rollback(id)
  → Promise<void>
```

---

## 📁 文件结构速查

### 类型定义 (packages/shared/src/)
```
index.ts       → 主出口 (re-export all)
platform.ts    → PlatformId, PlatformCapabilities, PlatformScanResult, ImportableRule
rule.ts        → UnifiedRule, CreateRuleDto, UpdateRuleDto, RuleScope, PlatformOverride
profile.ts     → Profile, CreateProfileDto, UpdateProfileDto, PublishPreview, PublishPreviewFile
revision.ts    → Revision, PublishedFile
errors.ts      → NotFoundError
```

### 核心逻辑 (packages/core/src/)
```
types.ts                 → PlatformAdapter 接口
registry.ts             → AdapterRegistry + createAdapterRegistry()
rules/store.ts          → FileRuleStore CRUD
rules/project.ts        → projectRule() 函数 (per-platform projection)
profiles/store.ts       → FileProfileStore CRUD
publish/engine.ts       → PublishEngine (preview + publish 编排)
publish/revision-store.ts → FileRevisionStore (持久化 + 回滚)
publish/platform-paths.ts → 平台特定路径映射
```

### 适配器 (packages/adapters/)
```
adapter-claude-code/src/index.ts  → claudeCodeAdapter (scan + importRules)
adapter-openclaw/src/index.ts     → openclawAdapter (scan + importRules)
adapter-codebuddy/src/index.ts    → codebuddyAdapter (scan + importRules)
```

### 服务器路由 (packages/server/src/routes/)
```
scan.ts       → POST /scan
rules.ts      → /rules/*
platforms.ts  → /platforms/:id/rules
profiles.ts   → /profiles/*
publish.ts    → /profiles/:id/preview, /profiles/:id/publish
revisions.ts  → /revisions/*
```

### 前端 (apps/web/src/)
```
App.tsx                   → 主应用 (tab 导航)
api/client.ts            → HTTP 基础
api/rules.ts             → rulesApi
api/profiles.ts          → profilesApi
api/platformRules.ts     → fetchPlatformRules()
api/revisions.ts         → revisionsApi
pages/RulesPage.tsx      → 规则列表
pages/RuleEditorPage.tsx → 规则编辑器
pages/ProfilesPage.tsx   → Profile 列表
pages/ProfileEditorPage.tsx → Profile 编辑器
pages/RevisionsPage.tsx  → 发布记录
utils/conflictDetection.ts → detectConflicts()
```

---

## 🚀 常用命令

```bash
# 启动开发服务
pnpm --filter @prism/server dev    # 后端 (port 3001)
pnpm --filter @prism/web dev       # 前端 (port 5173)

# 测试
pnpm test                           # 运行所有单元测试
pnpm --filter @prism/web test:e2e  # E2E 测试

# 构建
pnpm build

# 类型检查
pnpm type-check
```

---

## 💾 存储位置

```
~/.prism/
├── rules/
│   └── rules.json           # UnifiedRule[]
├── profiles/
│   └── profiles.json        # Profile[]
├── revisions/
│   ├── {revision-id}/...    # 发布记录目录
│   └── ...
└── backups/
    ├── {revision-id}/...    # 备份文件目录
    └── ...
```

---

## 🔄 核心数据流

### Scanner 流程
```
Browser GET /platforms
  ↓
Server: registry.scanAll()
  ├→ adapter-openclaw.scan()
  ├→ adapter-codebuddy.scan()
  └→ adapter-claude-code.scan()
  ↓
Browser ← { items: PlatformScanResult[] }
```

### Rule Import 流程
```
Browser: expandPlatformCard()
  ↓
Browser GET /platforms/:id/rules
  ↓
Server: adapter.importRules()
  ├→ readdir ~/.{platform}/rules/*.md
  └→ read each file
  ↓
Browser ← { items: ImportableRule[] }
  ↓
detectConflicts(platformRules, existingRules)
  ├→ new rule (name 未存在)
  ├→ conflict-skip (name 已存在)
  └→ conflict-overwrite (用户选择覆盖)
  ↓
User: toggle skip/overwrite
  ↓
User: import selected
  ↓
Browser: POST /rules (for each selected)
  ↓
Server: rulesStore.create() or update()
  ↓
Browser ← updated state
```

### Publish 流程
```
User: selectProfile + click "Publish"
  ↓
Browser GET /profiles/:id/preview
  ↓
Server: publishEngine.preview(profileId)
  ├→ profile.ruleIds[].each → rulesStore.get()
  ├→ projectRule() per-platform
  ├→ buildPublishPreview()
  ↓
Browser ← PublishPreview (show dry-run)
  ↓
User: confirm publish
  ↓
Browser POST /profiles/:id/publish
  ↓
Server: publishEngine.publish(profileId)
  ├→ backup existing files
  ├→ write new files
  ├→ create Revision record
  ↓
Browser ← { revision: Revision }
```

### Rollback 流程
```
User: select Revision + click "Rollback"
  ↓
Browser POST /revisions/:id/rollback
  ↓
Server: revisionStore.rollback(id)
  ├→ restore backup files
  ├→ delete new files
  ↓
Browser ← success
```

---

## 🎮 前端状态机 (PlatformCard Import UI)

### Per-Rule Status
```
Rule 初始状态
  ├→ 'new': 平台文件中存在，Prism 中不存在
  ├→ 'conflict-skip': 名称冲突，默认跳过
  ├→ 'conflict-overwrite': 名称冲突，用户选择覆盖
  ├→ 'imported': 已成功导入
  ├→ 'failed': 导入失败
  └→ 'skipped': 用户取消选择
```

### Checkbox 逻辑
```
checked = (status !== 'skipped') && (status !== 'imported') && (status !== 'failed')
disabled = (status === 'imported' || status === 'failed' || importing)

toggle: 在当前状态 ↔ 'skipped' 之间切换
overwrite: 在 'conflict-skip' ↔ 'conflict-overwrite' 之间切换
```

### 导入结果统计
```
success:  成功创建或更新的规则数
skipped:  用户跳过或原本已导入的规则数
failed:   导入失败的规则数
```

---

## 📌 关键设计点

| 特性 | 设计 | 原因 |
|------|------|------|
| **Local-first** | JSON 存储 (~/.prism) | 无云端依赖，快速 |
| **Per-platform projection** | projectRule() 函数 | 同一规则在不同平台可能内容不同 |
| **Per-rule state machine** | new/conflict/imported/failed | 用户精细控制导入流程 |
| **Backup + Revision** | 发布时备份，记录 Revision | 可完整回滚 |
| **Inline CSS** | 无 Tailwind/CSS 框架 | 最小化依赖，便于调试 |
| **Factory Pattern** | createAdapterRegistry() | 易于扩展新适配器 |

---

## ⚠️ 常见错误

```ts
// ❌ 错误：直接修改 UnifiedRule 后发送
const rule = await rulesApi.get(id)
rule.name = 'new name'
await rulesApi.update(id, rule)  // ❌ 发送整个对象，但 API 期望 UpdateRuleDto

// ✅ 正确：只发送变化的字段
await rulesApi.update(id, { name: 'new name' })

// ❌ 错误：忘记 platformId 是字面量类型
const platformId = user_input  // 可能是任意字符串
adapter = registry.get(platformId)  // 返回 undefined

// ✅ 正确：类型检查
const platformId: PlatformId = 'claude-code'
adapter = registry.get(platformId)  // 类型安全

// ❌ 错误：platformOverrides 结构
{ platformOverrides: { 'claude-code': 'content' } }  // ❌ 应该是对象

// ✅ 正确：
{ platformOverrides: { 'claude-code': { content: 'text' } } }
```

---

## 🔍 调试技巧

```bash
# 检查后端日志
pnpm --filter @prism/server dev 2>&1 | grep -i error

# 检查文件是否存在
ls -la ~/.prism/rules/rules.json

# 检查平台配置
ls -la ~/.claude-internal/rules/
ls -la ~/.openclaw/rules/
ls -la ~/.codebuddy/rules/

# 查看浏览器网络请求
Chrome DevTools → Network Tab
  过滤 XHR requests
  检查 Response body

# 检查前端状态
React DevTools Profiler
  记录 App 的 state 变化
  追踪 page 切换

# 重置测试数据
rm -rf ~/.prism  # 删除所有 Prism 数据
pnpm --filter @prism/server dev  # 后端会重新创建
```

---

## 📚 进一步学习

1. **读源码优先级**
   - packages/shared/src/  (5 分钟)
   - packages/core/src/registry.ts (5 分钟)
   - apps/web/src/App.tsx (10 分钟)
   - packages/server/src/index.ts (5 分钟)

2. **理解工作流**
   - docs/ARCHITECTURE.md (详细数据流)
   - docs/PROGRESS.md (版本历史)

3. **测试覆盖**
   - packages/core/src/__tests__/ (单元测试)
   - apps/web/src/e2e/ (E2E 测试)

4. **扩展新适配器**
   - 参考 adapter-claude-code/src/index.ts
   - 实现 scan() + importRules()
   - 注册到 createAdapterRegistry()

