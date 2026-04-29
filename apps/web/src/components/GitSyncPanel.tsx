import { useState } from 'react'
import type { SyncStatus } from '@prism/shared'

interface GitSyncPanelProps {
  status: SyncStatus
  lastSyncAt?: string
  branch?: string
  onPull: () => void
  onPush: (message: string) => void
  pushing: boolean
  pulling: boolean
}

const STATUS_DOT_COLOR: Record<SyncStatus, string> = {
  idle: 'var(--text-muted)',
  pushing: '#3b82f6',
  pulling: '#3b82f6',
  'conflict-detected': '#f97316',
  synced: '#22c55e',
  error: '#ef4444',
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: 'Idle',
  pushing: 'Pushing…',
  pulling: 'Pulling…',
  'conflict-detected': 'Conflict Detected',
  synced: 'Synced',
  error: 'Error',
}

const SPINNER_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 12,
  height: 12,
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
  verticalAlign: 'middle',
  marginRight: 6,
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function GitSyncPanel({
  status,
  lastSyncAt,
  branch,
  onPull,
  onPush,
  pushing,
  pulling,
}: GitSyncPanelProps) {
  const [showCommitForm, setShowCommitForm] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [commitError, setCommitError] = useState('')

  const isActive = pushing || pulling

  function handlePushClick() {
    setShowCommitForm(true)
    setCommitMessage('')
    setCommitError('')
  }

  function handlePushSubmit() {
    if (!commitMessage.trim()) {
      setCommitError('Commit message is required')
      return
    }
    setShowCommitForm(false)
    onPush(commitMessage.trim())
  }

  return (
    <div
      className="item-card"
      style={{ padding: '16px 20px', marginBottom: 16 }}
    >
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {/* Status dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: STATUS_DOT_COLOR[status],
            flexShrink: 0,
            boxShadow: isActive ? `0 0 6px ${STATUS_DOT_COLOR[status]}` : undefined,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {isActive && <span style={SPINNER_STYLE} />}
          {STATUS_LABEL[status]}
        </span>
        {branch && (
          <span style={{
            marginLeft: 4,
            fontSize: 12,
            color: 'var(--text-muted)',
            background: 'var(--bg-hover)',
            padding: '2px 8px',
            borderRadius: 10,
          }}>
            🌿 {branch}
          </span>
        )}
        {lastSyncAt && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            Last sync: {formatDate(lastSyncAt)}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={onPull}
          disabled={isActive}
        >
          {pulling ? <><span style={SPINNER_STYLE} />Pulling…</> : '⬇ Pull'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handlePushClick}
          disabled={isActive || showCommitForm}
        >
          {pushing ? <><span style={SPINNER_STYLE} />Pushing…</> : '⬆ Push'}
        </button>
      </div>

      {/* Inline commit message form */}
      {showCommitForm && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border-default)', paddingTop: 14 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Commit message
          </label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePushSubmit() }}
            placeholder="Update rules and skills"
            className="editor-meta-input"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
            autoFocus
          />
          {commitError && (
            <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', marginBottom: 8 }}>
              {commitError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handlePushSubmit}>
              Push
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCommitForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
