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
