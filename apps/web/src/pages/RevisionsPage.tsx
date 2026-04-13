import { useState, useEffect, useCallback } from 'react'
import type { Revision } from '@prism/shared'
import { revisionsApi } from '../api/revisions.js'

export function RevisionsPage() {
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingRollback, setConfirmingRollback] = useState<string | null>(null)
  const [rollingBack, setRollingBack] = useState<string | null>(null)
  const [rollbackResults, setRollbackResults] = useState<
    Record<string, { ok: true } | { ok: false; error: string }>
  >({})

  const loadRevisions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await revisionsApi.list()
      setRevisions(items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRevisions()
  }, [loadRevisions])

  const handleRollback = async (id: string) => {
    setRollingBack(id)
    setConfirmingRollback(null)
    try {
      await revisionsApi.rollback(id)
      setRollbackResults(prev => ({ ...prev, [id]: { ok: true } }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setRollbackResults(prev => ({ ...prev, [id]: { ok: false, error: message } }))
    } finally {
      setRollingBack(null)
    }
  }

  if (loading) {
    return <div style={{ padding: '1.5rem', color: '#6b7280' }}>加载中...</div>
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: '#dc2626' }}>
        加载失败: {error}
      </div>
    )
  }

  if (revisions.length === 0) {
    return (
      <div style={{ padding: '1.5rem', color: '#6b7280' }}>
        暂无发布记录。
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '720px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
        Revisions
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {revisions.map(rev => {
          const result = rollbackResults[rev.id]
          const isConfirming = confirmingRollback === rev.id
          const isRollingBack = rollingBack === rev.id
          const publishedDate = new Date(rev.publishedAt).toLocaleString()

          return (
            <div
              key={rev.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1rem',
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 500, color: '#111827' }}>{rev.profileName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {publishedDate} · {rev.files.length} files · revision {rev.id.slice(0, 8)}
                  </div>
                </div>
                <div>
                  {!isConfirming && !isRollingBack && !result && (
                    <button
                      onClick={() => setConfirmingRollback(rev.id)}
                      style={{
                        padding: '0.375rem 0.875rem',
                        background: '#fff',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Rollback
                    </button>
                  )}
                  {isRollingBack && (
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>回滚中...</span>
                  )}
                  {result && result.ok && (
                    <span style={{ fontSize: '0.875rem', color: '#16a34a' }}>已回滚</span>
                  )}
                  {result && !result.ok && (
                    <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                      回滚失败
                    </span>
                  )}
                </div>
              </div>

              {isConfirming && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}>
                  <p style={{ margin: '0 0 0.5rem', color: '#92400e' }}>
                    即将恢复 {rev.files.length} 个文件，确认回滚？
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleRollback(rev.id)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        background: '#d97706',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setConfirmingRollback(null)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        background: '#fff',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
