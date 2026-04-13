import type { RuleProjectionItem } from '../api/rules'

interface ProjectionPreviewProps {
  projections: RuleProjectionItem[]
  loading?: boolean
}

const PLATFORM_COLORS: Record<string, string> = {
  'claude-code': '#cc785c',
  'cursor': '#1a73e8',
  'openclaw': '#2e7d32',
  'codebuddy': '#7b1fa2',
}

export function ProjectionPreview({ projections, loading }: ProjectionPreviewProps) {
  if (loading) return <div className="projection-loading">Loading projections…</div>
  if (projections.length === 0) return <div className="projection-empty">No projections available</div>

  return (
    <div className="projection-preview">
      <h3>Platform Projections</h3>
      {projections.map(p => (
        <div
          key={p.platformId}
          className="projection-card"
          style={{ borderLeft: `4px solid ${PLATFORM_COLORS[p.platformId] ?? '#888'}` }}
        >
          <div className="projection-platform">{p.platformId}</div>
          {p.content !== null ? (
            <pre className="projection-content">{p.content}</pre>
          ) : (
            <div className="projection-empty-content">(uses global content)</div>
          )}
        </div>
      ))}
    </div>
  )
}
