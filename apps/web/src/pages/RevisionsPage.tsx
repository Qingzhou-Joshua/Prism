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
    return <div className="empty-state" style={{ margin: '1.5rem' }}>加载中...</div>
  }

  if (error) {
    return <div className="error-state" style={{ margin: '1.5rem' }}>加载失败: {error}</div>
  }

  if (revisions.length === 0) {
    return <div className="empty-state" style={{ margin: '1.5rem' }}>暂无发布记录。</div>
  }

  return (
    <div className="editor-page">
      <div className="page-header">
        <h2 className="page-title">Revisions</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {revisions.map(rev => {
          const result = rollbackResults[rev.id]
          const isConfirming = confirmingRollback === rev.id
          const isRollingBack = rollingBack === rev.id
          const publishedDate = new Date(rev.publishedAt).toLocaleString()

          return (
            <div key={rev.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {rev.profileName}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {publishedDate} · {rev.files.length} files · revision {rev.id.slice(0, 8)}
                  </div>
                </div>
                <div>
                  {!isConfirming && !isRollingBack && !result && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setConfirmingRollback(rev.id)}
                    >
                      Rollback
                    </button>
                  )}
                  {isRollingBack && (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>回滚中...</span>
                  )}
                  {result && result.ok && (
                    <span style={{ fontSize: '13px', color: '#4ade80' }}>✅ 已回滚</span>
                  )}
                  {result && !result.ok && (
                    <span style={{ fontSize: '13px', color: '#f87171' }}>
                      ❌ 回滚失败: {(result as { ok: false; error: string }).error}
                    </span>
                  )}
                </div>
              </div>

              {isConfirming && (
                <div className="confirm-inline" style={{ marginTop: '12px' }}>
                  <div className="confirm-inline-title">
                    即将恢复 {rev.files.length} 个文件，确认回滚？
                  </div>
                  <div className="confirm-inline-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => void handleRollback(rev.id)}
                    >
                      确认
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setConfirmingRollback(null)}
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
