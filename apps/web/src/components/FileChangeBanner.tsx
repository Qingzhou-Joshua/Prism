import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../api/client'
import type { WatcherChangeEvent } from '../hooks/useFileWatcher'

interface FileChangeBannerProps {
  changes: WatcherChangeEvent[]
  onDismiss: (entryId: string) => void
}

const PLATFORM_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codebuddy': 'Codebuddy',
  'openclaw': 'OpenClaw',
}

interface DiffContent {
  currentContent: string
  registryChecksum: string
  currentChecksum: string
}

export function FileChangeBanner({ changes, onDismiss }: FileChangeBannerProps) {
  const { t } = useTranslation('components')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [diffMap, setDiffMap] = useState<Record<string, DiffContent>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (changes.length === 0) return null

  async function handleViewDiff(entryId: string) {
    if (expandedId === entryId) {
      setExpandedId(null)
      return
    }

    setLoadingId(entryId)
    try {
      const res = await fetch(`${API_BASE}/registry/entries/${entryId}/content`)
      if (res.ok) {
        const data = await res.json() as DiffContent
        setDiffMap((prev) => ({ ...prev, [entryId]: data }))
        setExpandedId(entryId)
      }
    } catch {
      // 忽略请求失败
    } finally {
      setLoadingId(null)
    }
  }

  async function handleSync(entryId: string) {
    try {
      const res = await fetch(`${API_BASE}/registry/entries/${entryId}/sync`, { method: 'POST' })
      if (res.ok) {
        onDismiss(entryId)
        setExpandedId(null)
      }
    } catch {
      // 忽略请求失败
    }
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#7a5c00',
        borderBottom: '1px solid #b8860b',
        padding: '8px 20px',
      }}
    >
      {changes.map((change) => {
        const platformLabel = PLATFORM_LABELS[change.platformId] ?? change.platformId
        const isExpanded = expandedId === change.entryId
        const diff = diffMap[change.entryId]
        const isLoading = loadingId === change.entryId

        return (
          <div key={change.entryId}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                fontSize: 13,
                color: '#ffe082',
              }}
            >
              <span style={{ flex: 1 }}>
                ⚠ <strong>{change.assetName}</strong> {t('fileChangeBanner.modifiedIn', { platform: platformLabel })}
              </span>
              <button
                className="btn btn-sm"
                onClick={() => void handleViewDiff(change.entryId)}
                disabled={isLoading}
                style={{ minWidth: 100 }}
              >
                {isLoading ? t('fileChangeBanner.loading') : isExpanded ? t('fileChangeBanner.collapse') : t('fileChangeBanner.viewContent')}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => void handleSync(change.entryId)}
              >
                {t('fileChangeBanner.syncToPrism')}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => onDismiss(change.entryId)}
              >
                {t('fileChangeBanner.ignore')}
              </button>
            </div>

            {isExpanded && diff && (
              <pre
                style={{
                  margin: '4px 0 8px',
                  padding: '8px 12px',
                  background: 'rgba(0,0,0,0.35)',
                  borderRadius: 4,
                  fontSize: 12,
                  color: '#fff8e1',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxHeight: 300,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                <div style={{ marginBottom: 6, color: '#ffcc02', fontFamily: 'sans-serif' }}>
                  {t('fileChangeBanner.currentContent', { checksum: diff.currentChecksum.slice(0, 6) })}
                  {diff.registryChecksum && (
                    <span style={{ marginLeft: 12, color: '#ffd54f' }}>
                      {t('fileChangeBanner.vsRegistry', { checksum: diff.registryChecksum.slice(0, 6) })}
                    </span>
                  )}
                </div>
                {diff.currentContent}
              </pre>
            )}
          </div>
        )
      })}
    </div>
  )
}
