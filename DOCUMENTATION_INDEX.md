# Prism 文档索引

> 为了快速理解项目，请按以下顺序阅读文档

## 📌 从这里开始（3分钟快速上手）

1. **本文件** (DOCUMENTATION_INDEX.md) ← 你在这里
2. **QUICK_REFERENCE.md** (12KB, 5分钟)
   - 一页速查表：所有类型、API、文件结构
   - 适合快速查阅关键概念

3. **QUICK_SCAN.md** (18KB, 15分钟)
   - 完整的项目扫描报告
   - 包含所有部分的详细说明

## 🗂️ 官方文档（项目自带）

### 核心架构文档
- **docs/ARCHITECTURE.md** - 完整的架构设计
  - 核心接口定义
  - 数据流详解
  - API 端点清单
  - 存储层说明

- **docs/PROGRESS.md** - 开发进度追踪
  - 版本完成状态 (v0.1 - v0.6)
  - 当前下一步规划
  - 注意事项

### 版本计划和设计文档
```
docs/superpowers/plans/
├── 2026-04-13-v0.1-completion.md           # Scanner PoC
├── 2026-04-13-v0.2-rule-editor.md          # Rule Editor PoC
├── 2026-04-13-v0.4-profile-poc.md          # Profile PoC
├── 2026-04-13-v0.5-publish-pipeline.md     # Publish Pipeline
└── 2026-04-13-v0.6-rule-import.md          # Rule Import (当前)

docs/superpowers/specs/
├── 2026-04-13-v0.5-publish-pipeline-design.md
└── 2026-04-13-v0.6-rule-import-design.md
```

## 🎯 按用途选择文档

### 我想...

#### 快速了解项目是什么
- 阅读：QUICK_REFERENCE.md §1 (核心概念)
- 时间：2分钟

#### 理解系统架构
- 阅读：docs/ARCHITECTURE.md
- 时间：20分钟

#### 学习 API 端点
- 阅读：QUICK_REFERENCE.md §3 (API 端点速查)
- 或：QUICK_SCAN.md §5 (详细说明)
- 时间：5-10分钟

#### 理解类型系统
- 阅读：QUICK_REFERENCE.md §2 (类型一页速查)
- 或：QUICK_SCAN.md §2 (完整类型定义)
- 时间：5-10分钟

#### 查找某个 API 方法
- 查阅：QUICK_REFERENCE.md §5 (前端 API 客户端速查)
- 或：搜索 QUICK_SCAN.md 中的方法名

#### 理解前端应用结构
- 阅读：QUICK_SCAN.md §6 (前端应用结构)
- 时间：10分钟

#### 了解开发进度
- 阅读：docs/PROGRESS.md
- 时间：5分钟

#### 理解冲突检测流程
- 阅读：QUICK_REFERENCE.md §8 (核心数据流 → Rule Import 流程)
- 时间：5分钟

#### 学习如何扩展适配器
- 阅读：QUICK_SCAN.md §4 (适配器子包)
- 参考：packages/adapters/adapter-claude-code/src/index.ts
- 时间：15分钟

#### 调试问题
- 查阅：QUICK_REFERENCE.md §11 (调试技巧)
- 或：QUICK_REFERENCE.md §10 (常见错误)
- 时间：3-5分钟

## 📖 按阅读难度排序

### 入门级 (5-10分钟)
1. QUICK_REFERENCE.md §1 (核心概念)
2. QUICK_REFERENCE.md §2 (类型速查)
3. QUICK_REFERENCE.md §3 (API 端点速查)

### 中级 (15-30分钟)
1. QUICK_SCAN.md §1-3 (项目规模、类型、目录结构)
2. QUICK_SCAN.md §5 (路由清单)
3. docs/ARCHITECTURE.md (数据流部分)

### 高级 (30-60分钟)
1. docs/ARCHITECTURE.md (完整阅读)
2. QUICK_SCAN.md §9-11 (实现状态、设计决策、探索建议)
3. docs/superpowers/specs/*.md (最新设计细节)

### 深度学习 (60+分钟)
1. 阅读源码：packages/shared/src/*.ts (5分钟)
2. 阅读源码：packages/core/src/registry.ts (5分钟)
3. 阅读源码：apps/web/src/App.tsx (15分钟)
4. 运行 E2E 测试：pnpm --filter @prism/web test:e2e (20分钟)
5. 深入 PublishEngine：packages/core/src/publish/engine.ts (15分钟)

## 📁 文档地图

```
Prism/
├── DOCUMENTATION_INDEX.md          ← 你应该先看这个
├── QUICK_SCAN.md                   ← 最详细的报告（18KB）
├── QUICK_REFERENCE.md              ← 最实用的速查表（13KB）
├── CLAUDE.md                        # 项目初始计划（过时）
├── README.md                        # 项目说明（英文）
├── README.zh.md                     # 项目说明（中文）
│
└── docs/
    ├── prd.md                       # Product Requirements Document
    ├── ARCHITECTURE.md              # 架构文档
    ├── PROGRESS.md                  # 开发进度
    ├── ROADMAP.md                   # 产品路线图
    │
    └── superpowers/
        ├── plans/
        │   ├── 2026-04-13-v0.1-completion.md
        │   ├── 2026-04-13-v0.2-rule-editor.md
        │   ├── 2026-04-13-v0.4-profile-poc.md
        │   ├── 2026-04-13-v0.5-publish-pipeline.md
        │   └── 2026-04-13-v0.6-rule-import.md
        │
        └── specs/
            ├── 2026-04-13-v0.5-publish-pipeline-design.md
            └── 2026-04-13-v0.6-rule-import-design.md
```

## 🔍 快速搜索指南

### 我想找...

| 我想找... | 查阅文件 | 搜索关键词 |
|----------|---------|----------|
| PlatformAdapter 接口 | QUICK_SCAN.md §3 或 §4 | "PlatformAdapter interface" |
| UnifiedRule 类型 | QUICK_REFERENCE.md §2 | "interface UnifiedRule" |
| API 端点列表 | QUICK_REFERENCE.md §3 | "API 端点速查" |
| 规则导入流程 | QUICK_REFERENCE.md §8 | "Rule Import 流程" |
| 前端 API 对象 | QUICK_REFERENCE.md §5 | "API 对象接口速查" |
| 文件结构 | QUICK_REFERENCE.md §7 | "文件结构速查" |
| 常见错误 | QUICK_REFERENCE.md §10 | "常见错误" |
| 调试技巧 | QUICK_REFERENCE.md §11 | "调试技巧" |
| 适配器实现 | QUICK_SCAN.md §4 | "适配器导出模式" |
| 存储位置 | QUICK_REFERENCE.md §9 | "存储位置" |

## 💡 阅读建议

### 第一次阅读（推荐路径）
1. 这个文件 (DOCUMENTATION_INDEX.md) - 2分钟
2. QUICK_REFERENCE.md §1-3 - 5分钟
3. QUICK_SCAN.md §1-5 - 15分钟
4. 尝试运行项目 - 10分钟
5. **总计：30-40分钟，你就能理解整个项目**

### 日常工作参考
- 快速查询：**QUICK_REFERENCE.md** (最常用)
- 深入理解：**QUICK_SCAN.md**
- 官方详细：**docs/ARCHITECTURE.md**

### 新人入职
- DAY 1: 阅读此文件 + QUICK_REFERENCE.md (1小时)
- DAY 1: 运行项目 + 查看 E2E 测试 (1小时)
- DAY 2: 深读 QUICK_SCAN.md + docs/ARCHITECTURE.md (2小时)
- DAY 2: 阅读源代码关键文件 (1-2小时)
- DAY 3: 提交第一个 PR

## 🚀 从这里开始行动

### 快速上手（5分钟）
```bash
# 1. 启动后端
pnpm --filter @prism/server dev

# 2. 启动前端 (新终端)
pnpm --filter @prism/web dev

# 3. 访问
open http://localhost:5173
```

### 理解工作流（20分钟）
```bash
# 1. 阅读 QUICK_REFERENCE.md 的数据流部分
# 2. 在浏览器中操作：
#    - Scanner Tab 查看平台检测
#    - 展开某个平台查看可导入规则
#    - 点击导入并观察状态变化
# 3. 打开浏览器开发者工具查看 Network 请求
```

### 运行测试（10分钟）
```bash
# 单元测试
pnpm test

# E2E 测试
pnpm --filter @prism/web test:e2e
```

### 修改代码（30分钟）
```bash
# 1. 选择一个小功能 (例如：修改 PlatformCard UI)
# 2. 在源代码中找到相关文件：
#    - 前端：apps/web/src/App.tsx
#    - 类型：packages/shared/src/*.ts
# 3. 查阅 QUICK_REFERENCE.md 了解类型和 API
# 4. 修改代码并在浏览器测试
# 5. 运行 pnpm test 验证
```

## ❓ 常见问题

**Q: 项目有多大？**
A: 中等规模 Monorepo。代码主要集中在：
- packages/shared (纯类型, <500行)
- packages/core (核心逻辑, <2000行)
- packages/server (后端API, <1500行)
- apps/web (前端React, <2000行)

**Q: 我应该从哪个文件开始？**
A: 按以下顺序：
1. 这个文件 (DOCUMENTATION_INDEX.md)
2. QUICK_REFERENCE.md (§1-3)
3. 运行项目
4. QUICK_SCAN.md (全读)
5. docs/ARCHITECTURE.md (可选)

**Q: 怎样最快理解前端？**
A: 阅读 apps/web/src/App.tsx，它是整个应用的入口，包含了完整的路由和状态管理。

**Q: 怎样最快理解后端？**
A: 阅读 packages/server/src/index.ts，它展示了如何初始化所有 Stores 和注册所有路由。

**Q: 如何扩展新的平台适配器？**
A: 参考 packages/adapters/adapter-claude-code/src/index.ts，然后：
1. 复制该目录结构
2. 实现 scan() 方法
3. 实现 importRules() 方法
4. 在 packages/server/src/index.ts 中注册

**Q: 项目的持久化是怎样的？**
A: 完全基于 JSON 文件，存储在 ~/.prism/：
- rules.json: 所有规则
- profiles.json: 所有 Profile
- revisions/: 发布记录
- backups/: 备份文件

**Q: 能否连接数据库？**
A: 可以的。核心逻辑与存储层分离，通过 Store 接口抽象。
修改 FileRuleStore/FileProfileStore/FileRevisionStore 的实现即可。

## 📞 文档反馈

这份文档索引由 Claude Code 自动生成。如果你发现：
- 某个部分难以理解
- 缺少某些信息
- 文档过时

请提交反馈或 PR。

---

**最后更新**: 2026-04-13 (v0.6)  
**文档版本**: 1.0  
**状态**: ✅ 完整
