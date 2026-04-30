import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UnifiedHook, HookEventType } from '@prism/shared'
import { hooksApi } from '../api/hooks'

interface HooksPageProps {
  platformId: string
  onEdit: (hook: UnifiedHook) => void
  onNew: () => void
}

const EVENT_TYPE_ORDER: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SessionStart',
  'SessionEnd',
  'UserPromptSubmit',
  'SubagentStart',
  'SubagentStop',
]

function actionSummary(hook: UnifiedHook, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (hook.actions.length === 0) return t('hooks.noActions')
  const first = hook.actions[0]
  if (first.type === 'command') return t('hooks.actionScript', { cmd: first.command })
  if (first.type === 'http') return `${first.method ?? 'POST'} ${first.url}`
  if (first.type === 'prompt') return t('hooks.actionPrompt', { text: first.prompt.slice(0, 60) + (first.prompt.length > 60 ? '…' : '') })
  if (first.type === 'agent') return t('hooks.actionAgent', { text: first.agent })
  return t('hooks.actionUnknown')
}

export function HooksPage({ platformId, onEdit, onNew }: HooksPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [hooks, setHooks] = useState<UnifiedHook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await hooksApi.list(platformId)
      setHooks(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('hooks.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [platformId])

  useEffect(() => { void load() }, [load])

  async function handleDelete(hook: UnifiedHook) {
    if (!confirm(`Delete hook "${hook.matcher}"?`)) return
    setDeletingId(hook.id)
    try {
      await hooksApi.delete(platformId, hook.id)
      setHooks(prev => prev.filter(h => h.id !== hook.id))
    } catch (e) {
      alert(e instanceof Error ? e.message : t('hooks.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  function toggleCollapse(eventType: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(eventType)) {
        next.delete(eventType)
      } else {
        next.add(eventType)
      }
      return next
    })
  }

  if (loading) return <div className="loading-state">{tCommon('status.loading')}…</div>
  if (error) return (
    <div className="error-state">
      <span>⚠ {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>{tCommon('btn.retry')}</button>
    </div>
  )

  // Group by event type, preserving defined order then any extras
  const grouped = new Map<HookEventType, UnifiedHook[]>()
  for (const hook of hooks) {
    const list = grouped.get(hook.eventType) ?? []
    list.push(hook)
    grouped.set(hook.eventType, list)
  }
  const orderedKeys = [
    ...EVENT_TYPE_ORDER.filter(et => grouped.has(et)),
    ...[...grouped.keys()].filter(et => !EVENT_TYPE_ORDER.includes(et)),
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{t('hooks.title')}</div>
          <div className="page-subtitle">{t('hooks.count', { count: hooks.length })}</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>{t('hooks.newBtn')}</button>
      </div>

      {hooks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🪝</div>
          <div className="empty-state-title">{t('hooks.empty')}</div>
          <div className="empty-state-desc">{t('hooks.emptyHint')}</div>
          <button className="btn btn-primary" onClick={onNew}>{t('hooks.newBtn')}</button>
        </div>
      )}

      {orderedKeys.map(eventType => {
        const items = grouped.get(eventType)!
        const isCollapsed = collapsed.has(eventType)
        return (
          <div key={eventType} className="hooks-event-group">
            <button
              className="hooks-event-header"
              onClick={() => toggleCollapse(eventType)}
            >
              <span className="hooks-event-chevron">{isCollapsed ? '▶' : '▼'}</span>
              <span className="hooks-event-type">{eventType}</span>
              <span className="hooks-event-count">{items.length}</span>
            </button>

            {!isCollapsed && (
              <div className="hooks-event-items">
                {items.map(hook => (
                  <div
                    key={hook.id}
                    className="item-card"
                    onClick={() => onEdit(hook)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="item-card-name hooks-matcher">{hook.matcher}</div>
                    {hook.description && (
                      <div className="item-card-filepath">{hook.description}</div>
                    )}
                    <div className="hooks-action-preview">{actionSummary(hook, t)}</div>
                    {hook.actions.length > 1 && (
                      <div className="hooks-action-more">+{hook.actions.length - 1} more action{hook.actions.length > 2 ? 's' : ''}</div>
                    )}
                    <div className="item-card-footer">
                      <span className="item-card-date">{new Date(hook.updatedAt).toLocaleDateString()}</span>
                      <div className="item-card-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => { e.stopPropagation(); void handleDelete(hook) }}
                          disabled={deletingId === hook.id}
                        >
                          {deletingId === hook.id ? '…' : tCommon('btn.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
