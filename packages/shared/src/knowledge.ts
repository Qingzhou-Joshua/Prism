export interface DeveloperProfile {
  name?: string
  role?: string
  bio: string
  skills: string[]
  updatedAt: string
}

export interface KnowledgeEntry {
  id: string
  domain: string
  summary: string
  content: string
  tags: string[]
  projectPath?: string
  sessionDate: string
  createdAt: string
}

export interface CreateKnowledgeEntryDto {
  domain: string
  summary: string
  content: string
  tags: string[]
  projectPath?: string
  sessionDate: string
}

export interface IngestKnowledgeDto {
  session_id?: string
  transcript?: Array<{ role: string; content: string | unknown[] }>
  cwd?: string
}

export interface GeneratedAsset {
  id: string
  type: 'rule' | 'skill'
  name: string                     // 建议的资产名称，用于生成文件名
  content: string                  // 生成的 Markdown 内容
  sourceType: 'developer-profile' | 'knowledge-entries'
  sourceIds?: string[]             // 来源 entry IDs
  domain?: string
  projectPath?: string
  generatedAt: string              // ISO 时间戳
  publishedTo: Array<{
    platformId: string
    symlinkPath: string            // IDE 目录中的 symlink 完整路径
    linkedAt: string
  }>
}

export interface GenerateProjectRuleDto {
  domain?: string
  projectPath?: string
}

export interface PublishGeneratedAssetDto {
  platformId: string
  assetType: 'rule' | 'skill'
}
