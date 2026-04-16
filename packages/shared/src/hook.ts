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

export interface UnifiedHook {
  id: string
  eventType: HookEventType
  matcher: string
  description?: string
  actions: HookAction[]
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
