import { useState } from 'react'
import type { RuleProjectionItem } from '../api/rules'

interface ProjectionPreviewProps {
  projections: RuleProjectionItem[]
  loading?: boolean
}

const PLATFORM_DOTS: Record<string, string> = {
  'claude-code': '#e65c46',
  'codebuddy':   '#c084fc',
}

export function ProjectionPreview({ projections, loading }: ProjectionPreviewProps) {
  const [activeTab, setActiveTab] = useState(0)

  if (loading) {
    return (
      <div className="proj-wrap">
        <div className="proj-loading">Loading projections…</div>
      </div>
    )
  }

  if (projections.length === 0) {
    return (
      <div className="proj-wrap">
        <div className="proj-empty">No projections available</div>
      </div>
    )
  }

  const clampedTab = Math.min(activeTab, projections.length - 1)
  const current = projections[clampedTab]

  return (
    <div className="proj-wrap">
      <div className="proj-tabs" role="tablist">
        {projections.map((p, i) => (
          <button
            key={p.platformId}
            role="tab"
            aria-selected={i === clampedTab}
            className={`proj-tab${i === clampedTab ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <span
              className="proj-tab-dot"
              style={{ background: PLATFORM_DOTS[p.platformId] ?? '#888' }}
            />
            {p.platformId}
          </button>
        ))}
      </div>

      <div className="proj-body">
        {current.content !== null ? (
          <pre className="proj-content">{current.content}</pre>
        ) : (
          <div className="proj-empty-content">(uses global content)</div>
        )}
      </div>
    </div>
  )
}
