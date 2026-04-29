import type { UnifiedCommand, CreateCommandDto, UpdateCommandDto } from '@prism/shared'

export interface CommandStore {
  list(): Promise<UnifiedCommand[]>
  get(id: string): Promise<UnifiedCommand | null>
  create(dto: CreateCommandDto): Promise<UnifiedCommand>
  update(id: string, dto: UpdateCommandDto): Promise<UnifiedCommand | null>
  delete(id: string): Promise<boolean>
}
