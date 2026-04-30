import { useTranslation } from 'react-i18next'
import Editor from '@monaco-editor/react'
import type { KnowledgeEntry } from '@prism/shared'

interface KnowledgeEntryDetailPageProps {
  entry: KnowledgeEntry
  onBack: () => void
  onDelete: () => void
}

export function KnowledgeEntryDetailPage({ entry, onBack, onDelete }: KnowledgeEntryDetailPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t

  function handleDelete() {
    if (!window.confirm(`${t('knowledgeEntry.deleteConfirm')}\n\n"${entry.summary}"`)) return
    onDelete()
  }

  return (
    <div className="editor-page">
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          {tCommon('btn.back2knowledge')}
        </button>

        <div className="editor-toolbar-divider" />

        <span className="badge badge-accent">{entry.domain}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {new Date(entry.sessionDate).toLocaleDateString()}
        </span>

        <div className="editor-toolbar-divider" />

        <div className="editor-toolbar-actions">
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            {t('knowledgeEntry.deleteEntry')}
          </button>
        </div>
      </div>

      {/* ── Meta strip ── */}
      <div className="editor-meta-strip">
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          projectPath: <strong style={{ color: 'var(--text-secondary)' }}>{entry.projectPath ?? '-'}</strong>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
          tags:&nbsp;
          {entry.tags.length > 0
            ? entry.tags.map(tag => (
                <span key={tag} className="badge badge-muted" style={{ marginRight: 4 }}>{tag}</span>
              ))
            : <strong style={{ color: 'var(--text-secondary)' }}>-</strong>
          }
        </span>
      </div>

      {/* ── Summary strip ── */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border-default)',
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>Summary:</strong> {entry.summary}
      </div>

      {/* ── Read-only Monaco editor ── */}
      <div className="editor-full">
        <div className="monaco-wrapper">
          <Editor
            height="100%"
            defaultLanguage="markdown"
            theme="vs-dark"
            value={entry.content}
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 14,
              readOnly: true,
            }}
          />
        </div>
      </div>
    </div>
  )
}
