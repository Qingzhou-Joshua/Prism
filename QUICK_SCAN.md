# Prism 项目快速探索报告
**生成时间**: 2026-04-13  
**项目位置**: `/Users/joshuachen/AIProject/Prism`

---

## 1. 最近提交记录 (git log --oneline -10)

```
60e3388 chore: add Playwright setup, gitignore artifacts, profile-delete E2E tests
ec7e438 test(e2e): add Playwright rule import flow test
a85d58c feat(web): add rule import UI to PlatformCard with per-rule state machine
e0f9f49 refactor: improve conflictDetection code quality
0b53741 feat: add detectConflicts utility with unit tests
264bc00 feat: add fetchPlatformRules API client
602a187 refactor: use English comments in ImportableRule
d762dc2 feat: add ImportableRule interface to shared types
671424e docs: add v0.6 rule import design spec
0c5af94 docs: require E2E test after every bug fix
```

**当前版本**: v0.6 (Rule Import)  
**核心交付**: Platform rule scanning + conflict detection + import UI

---

## 2. 类型定义系统 (packages/shared/src/)

### 2.1 核心类型文件清单
```
packages/shared/src/
├── index.ts          # 主出口（re-export所有类型）
├── platform.ts       # PlatformId / PlatformCapabilities / PlatformScanResult / ImportableRule
├── rule.ts           # UnifiedRule / CreateRuleDto / UpdateRuleDto / RuleScope / PlatformOverride
├── profile.ts        # Profile / CreateProfileDto / UpdateProfileDto / PublishPreview / PublishPreviewFile
├── revision.ts       # Revision / PublishedFile
└── errors.ts         # NotFoundError
```

### 2.2 关键类型接口速查表

| 类型 | 文件 | 用途 | 关键字段 |
|-----|-----|------|---------|
| **UnifiedRule** | rule.ts | Prism 管理的规则 | id, name, content, scope(global\|project), tags[], platformOverrides |
| **CreateRuleDto** | rule.ts | 创建规则请求体 | name, content, scope, tags?, platformOverrides? |
| **UpdateRuleDto** | rule.ts | 更新规则请求体 | name?, content?, scope?, tags?, platformOverrides? |
| **PlatformId** | platform.ts | 平台类型字面量 | 'openclaw' \| 'claude-code' \| 'cursor' \| 'codebuddy' |
| **PlatformScanResult** | platform.ts | 平台扫描结果 | id, displayName, detected, configPath?, message?, capabilities, rulesDetected? |
| **ImportableRule** | platform.ts | 平台导入规则对象 | name (从 fileName 派生), content, fileName |
| **Profile** | profile.ts | 规则集合 + 目标平台 | id, name, description?, ruleIds[], targetPlatforms[], createdAt, updatedAt |
| **PublishPreview** | profile.ts | 发布预览 | profileId, profileName, targetPlatforms[], files[] |
| **PublishedFile** | revision.ts | 已发布的文件 | platformId, filePath, backupPath?, isNew, ruleId, ruleName |
| **Revision** | revision.ts | 发布记录 | id, profileId, profileName, publishedAt, files[] |

### 2.3 类型关系图
```
UnifiedRule 
  ├─→ PlatformOverride (per-platform content override)
  └─→ platformOverrides: Record<PlatformId, PlatformOverride>

Profile
  ├─→ ruleIds[]        (references UnifiedRule.id)
  └─→ targetPlatforms  (array of PlatformId)

PublishPreview
  ├─→ files: PublishPreviewFile[]
  │    └─→ platformId + filePath + content (for each rule per platform)

Revision
  ├─→ files: PublishedFile[]
  │    └─→ backupPath (when isNew=false)
```

---

## 3. Core 包结构 (packages/core/src/)

```
packages/core/src/
├── index.ts                    # 主出口 (export registry, stores, engine, adapter types)
├── types.ts                    # PlatformAdapter 接口定义
├── registry.ts                 # AdapterRegistry + createAdapterRegistry()
├── rules/
│   ├── store.ts               # FileRuleStore 类 (CRUD UnifiedRule)
│   ├── store.test.ts
│   └── project.ts             # projectRule() 函数 (per-platform projection)
├── profiles/
│   ├── store.ts               # FileProfileStore 类 (CRUD Profile)
│   └── store.test.ts
├── publish/
│   ├── engine.ts              # PublishEngine 类 (preview + publish 编排)
│   ├── engine.test.ts
│   ├── revision-store.ts      # FileRevisionStore 类 (Revision 持久化 + 回滚)
│   ├── revision-store.test.ts
│   └── platform-paths.ts      # 平台特定路径映射 (Claude Code, OpenClaw, CodeBuddy)
├── scanPlatforms.test.ts
└── __tests__/
    └── registry.test.ts       # AdapterRegistry 单元测试
```

### 关键抽象

#### PlatformAdapter 接口 (types.ts)
```ts
interface PlatformAdapter {
  id: PlatformId
  displayName: string
  capabilities: PlatformCapabilities
  scan(): Promise<PlatformScanResult>
  importRules?(): Promise<ImportedRule[]>
}
```

#### AdapterRegistry 接口 (registry.ts)
```ts
interface AdapterRegistry {
  getAll: () => PlatformAdapter[]
  get: (id: PlatformId) => PlatformAdapter | undefined
  scanAll: () => Promise<PlatformScanResult[]>
}
```

#### Store 模式
- **FileRuleStore**: 管理 `~/.prism/rules/rules.json` (UnifiedRule 持久化)
- **FileProfileStore**: 管理 `~/.prism/profiles/profiles.json` (Profile 持久化)
- **FileRevisionStore**: 管理 `~/.prism/revisions/` + `~/.prism/backups/` (Revision 持久化 + 备份)

---

## 4. 适配器子包 (packages/adapters/)

### 4.1 三个平台适配器目录结构

```
packages/adapters/
├── adapter-claude-code/
│   ├── src/
│   │   ├── index.ts  (claudeCodeAdapter 实现)
│   │   └── ...
│   ├── package.json  (name: "@prism/adapter-claude-code")
│   └── tsconfig.json
├── adapter-codebuddy/
│   ├── src/
│   │   ├── index.ts  (codebuddyAdapter 实现)
│   │   └── ...
│   └── package.json  (name: "@prism/adapter-codebuddy")
└── adapter-openclaw/
    ├── src/
    │   ├── index.ts  (openclawAdapter 实现)
    │   └── ...
    └── package.json  (name: "@prism/adapter-openclaw")
```

### 4.2 每个适配器的实现要点

| 适配器 | Platform ID | 配置路径 | scan() 实现 | importRules() 实现 |
|-------|------------|---------|-----------|------------------|
| Claude Code | 'claude-code' | ~/.claude-internal (fallback: ~/.claude) | 检查 ~/.claude-internal 存在 + rules/ 子目录 | readdir ~/{rules}/*.md |
| OpenClaw | 'openclaw' | ~/.openclaw | 检查 ~/.openclaw 存在 + rules/ 子目录 | readdir ~/{rules}/*.md |
| CodeBuddy | 'codebuddy' | ~/.codebuddy | 检查 ~/.codebuddy 存在 + rules/ 子目录 | readdir ~/{rules}/*.md |

### 4.3 适配器导出模式

**✅ 有 importRules 方法**: 所有三个适配器都实现了 `importRules?()` 方法
- 类型: `() => Promise<ImportedRule[]>`
- 返回: 文件名以 .md 结尾的规则对象数组
- 文件名转规则名: `common-coding-style.md` → `common coding style`

**无 importSkills / importAgents 方法**: (当前版本不支持)

---

## 5. 服务器路由清单 (packages/server/src/)

### 5.1 注册的所有路由

```
GET    /health                          # 健康检查
GET    /platforms                       # 获取所有平台扫描结果
POST   /scan                            # 触发重新扫描 (可选: 指定 platformId)

GET    /rules                           # 列出所有 Prism 规则
POST   /rules                           # 创建新规则
GET    /rules/:id                       # 获取单条规则
PUT    /rules/:id                       # 更新规则
DELETE /rules/:id                       # 删除规则
GET    /rules/:id/projections           # 获取单条规则的各平台 projection

GET    /platforms/:id/rules             # 获取某平台的可导入规则列表

GET    /profiles                        # 列出所有 Profile
POST   /profiles                        # 创建 Profile
GET    /profiles/:id                    # 获取单条 Profile
PUT    /profiles/:id                    # 更新 Profile
DELETE /profiles/:id                    # 删除 Profile
GET    /profiles/:id/preview            # 获取 Profile 发布预览
POST   /profiles/:id/publish            # 执行发布

GET    /revisions                       # 列出所有发布记录
GET    /revisions/:id                   # 获取单条发布记录详情
POST   /revisions/:id/rollback          # 执行回滚
```

### 5.2 路由文件对应关系

| 路由文件 | 对应路由 | 功能 |
|---------|---------|------|
| routes/scan.ts | POST /scan | 平台扫描编排 |
| routes/rules.ts | /rules/* | 规则 CRUD + projections |
| routes/platforms.ts | /platforms/:id/rules | 平台规则导入 |
| routes/profiles.ts | /profiles/* | Profile CRUD |
| routes/publish.ts | /profiles/:id/preview, /profiles/:id/publish | 发布编排 |
| routes/revisions.ts | /revisions/* | 发布记录 + 回滚 |

### 5.3 Server index.ts 初始化逻辑

```ts
// 1. 创建 Fastify 实例 + CORS 注册
const app = Fastify({ logger: true })
await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

// 2. 创建 AdapterRegistry (3个适配器)
const registry = createAdapterRegistry([
  openclawAdapter,
  codebuddyAdapter,
  claudeCodeAdapter,
])

// 3. 初始化 Stores
const rulesStore = new FileRuleStore(~/.prism/rules/rules.json)
const profileStore = new FileProfileStore(~/.prism/profiles/profiles.json)
const revisionStore = new FileRevisionStore(~/.prism/revisions, ~/.prism/backups)
const publishEngine = new PublishEngine(rulesStore, profileStore)

// 4. 注册所有路由
registerScanRoutes(app, registry)
registerRulesRoutes(app, rulesStore)
registerPlatformRulesRoutes(app, registry)
registerProfileRoutes(app, profileStore, rulesStore)
registerPublishRoutes(app, publishEngine, revisionStore)
registerRevisionRoutes(app, revisionStore)

// 5. 启动服务器 (port 3001)
await app.listen({ port: 3001, host: '0.0.0.0' })
```

---

## 6. 前端应用结构 (apps/web/src/)

### 6.1 App.tsx 页面导航类型定义

```ts
type Page =
  | { view: 'scanner' }                           // 平台扫描器主页面
  | { view: 'rules-list' }                        # 规则列表页面
  | { view: 'rules-edit'; rule: UnifiedRule }     # 编辑已有规则
  | { view: 'rules-new' }                         # 新建规则
  | { view: 'profiles-list' }                     # Profile 列表页面
  | { view: 'profiles-new' }                      # 新建 Profile
  | { view: 'profiles-edit'; profile: Profile }   # 编辑已有 Profile
  | { view: 'revisions' }                         # 发布记录页面
```

### 6.2 Tab 导航栏

```
[Scanner] [Rules] [Profiles] [Revisions]
```

每个 Tab 对应 Page 类型的一个分支。Rules/Profiles 内部还有子状态 (list/new/edit)。

### 6.3 App.tsx 的关键功能

- **Scanner Tab**: PlatformCard 组件列表 + Platform Rule Import UI
  - 展示每个平台的检测状态
  - 可导入规则列表（当 detected && rulesDetected 时）
  - Per-rule 状态机: new / conflict-skip / conflict-overwrite / imported / failed / skipped
  - 冲突检测 + 全选/取消全选 + 导入操作

- **Rules Tab**: RulesPage / RuleEditorPage 组件
- **Profiles Tab**: ProfilesPage / ProfileEditorPage 组件
- **Revisions Tab**: RevisionsPage 组件

### 6.4 文件组织

```
apps/web/src/
├── App.tsx                    # 主应用入口 (tab 导航 + routing)
├── api/
│   ├── client.ts             # HTTP 基础请求客户端 (API_BASE = http://localhost:3001)
│   ├── rules.ts              # rulesApi object (list/get/create/update/delete/projections)
│   ├── profiles.ts           # profilesApi object (list/get/create/update/delete/preview/publish)
│   ├── platformRules.ts      # fetchPlatformRules(platformId) 函数
│   └── revisions.ts          # revisionsApi object (list/get/rollback)
├── pages/
│   ├── RulesPage.tsx         # Rules 列表页面组件
│   ├── RuleEditorPage.tsx    # 规则编辑器 (Monaco Editor)
│   ├── ProfilesPage.tsx      # Profile 列表页面组件
│   ├── ProfileEditorPage.tsx # Profile 编辑器
│   └── RevisionsPage.tsx     # 发布记录查看器
├── utils/
│   └── conflictDetection.ts  # detectConflicts() 函数 (冲突检测逻辑)
└── vite.config.ts
```

---

## 7. 前端 API 客户端 (apps/web/src/api/)

### 7.1 API 文件清单

```
apps/web/src/api/
├── client.ts          # HTTP 基础 (API_BASE, request<T>() 函数)
├── rules.ts           # rulesApi 对象
├── profiles.ts        # profilesApi 对象  
├── platformRules.ts   # fetchPlatformRules() 函数
└── revisions.ts       # revisionsApi 对象
```

### 7.2 API 对象接口速查表

#### rulesApi (rules.ts)
```ts
{
  list(): Promise<UnifiedRule[]>
  get(id): Promise<UnifiedRule | null>
  create(dto: CreateRuleDto): Promise<UnifiedRule>
  update(id, dto: UpdateRuleDto): Promise<UnifiedRule>
  delete(id): Promise<void>
  projections(id): Promise<RuleProjectionItem[]>
    // RuleProjectionItem = { platformId: string; content: string | null }
}
```

#### profilesApi (profiles.ts)
```ts
{
  list(): Promise<Profile[]>
  get(id): Promise<Profile | null>
  create(dto: CreateProfileDto): Promise<Profile>
  update(id, dto: UpdateProfileDto): Promise<Profile>
  delete(id): Promise<void>
  preview(id): Promise<PublishPreview>
  publish(id): Promise<{ revision: Revision }>
}
```

#### fetchPlatformRules (platformRules.ts)
```ts
async function fetchPlatformRules(platformId: string): Promise<ImportableRule[]>
// 返回类型
interface PlatformRulesResponse {
  platformId: string
  items: ImportableRule[]
}
```

#### revisionsApi (revisions.ts)
```ts
{
  list(): Promise<Revision[]>
  get(id): Promise<Revision | null>
  rollback(id): Promise<void>
}
```

### 7.3 HTTP 请求基础 (client.ts)

```ts
const API_BASE = 'http://localhost:3001'

async function request<T>(path: string, init?: RequestInit): Promise<T | null>
  // 返回 null on 204 No Content
  // 抛错 on !res.ok
  // 默认 Content-Type: application/json (if body exists)
```

---

## 8. 文档目录结构 (docs/)

```
docs/
├── prd.md                                    # Product Requirements Document
├── ARCHITECTURE.md                           # 架构文档 (v0.2 更新)
├── PROGRESS.md                               # 开发进度追踪 (v0.6 当前)
├── ROADMAP.md                                # 产品路线图
├── superpowers/
│   ├── plans/
│   │   ├── 2026-04-13-v0.1-completion.md    # v0.1 完成计划
│   │   ├── 2026-04-13-v0.2-rule-editor.md   # v0.2 规则编辑器计划
│   │   ├── 2026-04-13-v0.4-profile-poc.md   # v0.4 Profile PoC 计划
│   │   ├── 2026-04-13-v0.5-publish-pipeline.md # v0.5 发布管线计划
│   │   └── 2026-04-13-v0.6-rule-import.md   # v0.6 规则导入计划 (当前)
│   └── specs/
│       ├── 2026-04-13-v0.5-publish-pipeline-design.md # 发布管线设计文档
│       └── 2026-04-13-v0.6-rule-import-design.md       # 规则导入设计文档
```

### 8.1 文档内容概览

| 文件 | 内容 | 更新时间 |
|-----|------|---------|
| ARCHITECTURE.md | 完整的架构、核心接口、数据流、API 清单 | v0.2 (2026-04-13) |
| PROGRESS.md | 版本完成状态 (v0.1-v0.6) + 当前下一步 | v0.6 (2026-04-13) |
| prd.md | 产品定位、核心功能、用户故事 | (未读) |
| ROADMAP.md | 产品路线图 (v0.7 及以后) | (未读) |

---

## 9. 实现状态概览

### ✅ 已完成功能 (v0.1 - v0.6)

| 功能 | 版本 | 状态 |
|-----|------|------|
| Platform Scanner (3 adapters) | v0.1 | ✅ 完成 |
| Rule CRUD + Projection Preview | v0.2 | ✅ 完成 |
| Platform Rule Import | v0.3 | ✅ 完成 |
| Profile CRUD + Publish Preview | v0.4 | ✅ 完成 |
| Publish Pipeline + Rollback | v0.5 | ✅ 完成 |
| Rule Import UI + Conflict Detection | v0.6 | ✅ 完成 (当前) |

### 📋 规划中功能

- v0.7: Skills/Agents 导入 (基础支撑)
- v0.8: Workspace profiling (跨工作区管理)
- v1.0: Stable Release

### 🔧 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| UI/UX | Inline styles (no CSS framework, intentional minimalism) |
| 编辑器 | Monaco Editor (@monaco-editor/react) |
| HTTP 客户端 | Fetch API (浏览器原生) |
| 后端 | Fastify + TypeScript |
| 包管理 | pnpm workspace |
| 构建编排 | Turbo |
| 存储 | JSON 文件 (~/.prism/*) |
| 测试 | Vitest + Playwright E2E |

---

## 10. 快速启动命令

```bash
# 终端 1: 启动后端服务 (port 3001)
pnpm --filter @prism/server dev

# 终端 2: 启动前端开发服务 (port 5173)
pnpm --filter @prism/web dev

# 访问
http://localhost:5173

# 运行测试
pnpm test

# 运行 E2E 测试
pnpm --filter @prism/web test:e2e
```

---

## 11. 关键设计决策

| 决策 | 理由 |
|-----|------|
| Local-first JSON 存储 | 无需云端依赖，快速原型 |
| 每个 PlatformId 一个适配器 | 独立维护，易于扩展新平台 |
| Unified Types 在 @prism/shared | 前后端类型共享，减少 DTO 重复 |
| Store 模式 (Rule/Profile/Revision) | 易于切换持久化实现 (SQL、其他) |
| Per-rule State Machine (新→冲突跳过/覆盖→导入) | 用户完整控制导入流程 |
| Inline CSS (no Tailwind) | 最小化依赖，快速渲染，便于调试 |

---

## 12. 下一步探索建议

如果继续开发，建议按以下优先级：

1. **查看完整的 E2E 测试** (Playwright 配置)
   - `pnpm --filter @prism/web test:e2e`
   - 覆盖 rule import flow

2. **深入 PublishEngine 实现**
   - `packages/core/src/publish/engine.ts`
   - 理解 publish preview / publish / rollback 的完整逻辑

3. **读 Superpowers 计划文档**
   - `docs/superpowers/plans/2026-04-13-v0.6-rule-import.md`
   - 了解最新的需求和实现细节

4. **理解 conflictDetection.ts**
   - `apps/web/src/utils/conflictDetection.ts`
   - 冲突检测算法的完整逻辑

5. **检查平台特定路径映射**
   - `packages/core/src/publish/platform-paths.ts`
   - 各平台规则文件的发布路径差异

