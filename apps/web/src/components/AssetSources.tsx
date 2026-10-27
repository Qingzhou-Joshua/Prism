import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PluginAssetGroup, PluginAssetItem, PluginAssetType, PluginInfo } from '@prism/shared'
import { pluginsApi } from '../api/plugins'
import { PixelIcon } from './PixelIcon'
import { CardSummary, matchesQuery } from './CardSummary'

// ── Own + plugin asset layout ───────────────────────────────────────────────
//
// List pages show the user's own assets first (editable) and plugin-provided
// assets below, one collapsible group per plugin (read-only). A source filter
// narrows to "mine" or a single plugin; search spans every source.

const PREVIEW_COUNT = 12

export function usePluginAssets(platformId: string, type: PluginAssetType) {
  const [groups, setGroups] = useState<PluginAssetGroup[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    pluginsApi.assets(type, platformId)
      .then(g => { if (!cancelled) setGroups(g) })
      .catch(() => { if (!cancelled) setGroups([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [platformId, type])
  return { groups, loading }
}

interface AssetSourcesProps {
  platformId: string
  type: PluginAssetType
  /** Label of the asset type, e.g. "Skills". */
  typeLabel: string
  query: string
  ownCount: number
  /** Own items matching `query` — drives the no-match message. */
  ownMatchCount: number
  /** Names of own items, to flag plugin items with the same name. */
  ownNames?: string[]
  /** The page's own card grid / empty state. */
  children: ReactNode
}

type Source = 'all' | 'mine' | string

export function AssetSources({ platformId, type, typeLabel, query, ownCount, ownMatchCount, ownNames = [], children }: AssetSourcesProps) {
  const { t } = useTranslation('common')
  const { groups } = usePluginAssets(platformId, type)
  const [source, setSource] = useState<Source>('all')
  const [showDisabled, setShowDisabled] = useState(false)
  const [ownOpen, setOwnOpen] = useState(true)
  const [viewing, setViewing] = useState<{ item: PluginAssetItem; plugin: PluginInfo } | null>(null)

  // Reset the filter when switching platform
  useEffect(() => { setSource('all') }, [platformId])

  const visibleGroups = useMemo(
    () => groups.filter(g => (showDisabled || g.plugin.enabled) && (source === 'all' || source === g.plugin.id)),
    [groups, showDisabled, source],
  )
  const hiddenDisabled = groups.filter(g => !g.plugin.enabled).length
  const ownNameSet = useMemo(() => new Set(ownNames.map(n => n.toLowerCase())), [ownNames])
  const pluginMatches = visibleGroups.reduce((n, g) => n + g.items.filter(i => matchesQuery(i, query)).length, 0)
  const showOwn = source === 'all' || source === 'mine'
  const nothingMatches = query.trim() !== '' && (showOwn ? ownMatchCount : 0) + pluginMatches === 0

  return (
    <div className="asset-sources">
      {groups.length > 0 && (
        <div className="source-bar" role="tablist" aria-label={t('sources.filter')}>
          <SourceChip active={source === 'all'} onClick={() => setSource('all')} label={t('sources.all')} />
          <SourceChip active={source === 'mine'} onClick={() => setSource('mine')} label={t('sources.mine')} count={ownCount} />
          {groups.filter(g => showDisabled || g.plugin.enabled).map(g => (
            <SourceChip
              key={g.plugin.id}
              active={source === g.plugin.id}
              onClick={() => setSource(g.plugin.id)}
              label={g.plugin.name}
              count={g.items.length}
              muted={!g.plugin.enabled}
            />
          ))}
          {hiddenDisabled > 0 && (
            <label className="source-bar-toggle">
              <input type="checkbox" checked={showDisabled} onChange={e => setShowDisabled(e.target.checked)} />
              {t('sources.showDisabled', { count: hiddenDisabled })}
            </label>
          )}
        </div>
      )}

      {showOwn && (
        <section className="source-section">
          {groups.length > 0 && (
            <button className="source-section-header" onClick={() => setOwnOpen(o => !o)} aria-expanded={ownOpen}>
              <span data-chevron={ownOpen ? 'open' : 'closed'}><PixelIcon name={ownOpen ? 'chevron-down' : 'chevron-right'} size={16} /></span>
              <span className="source-section-title">{t('sources.mineTitle', { type: typeLabel })}</span>
              <span className="source-section-count">{ownCount}</span>
              <span className="badge badge-muted">{t('sources.editable')}</span>
            </button>
          )}
          {ownOpen && children}
        </section>
      )}

      {visibleGroups.map(g => (
        <PluginGroup
          key={g.plugin.id}
          group={g}
          query={query}
          ownNameSet={ownNameSet}
          defaultOpen={source === g.plugin.id}
          onOpen={item => setViewing({ item, plugin: g.plugin })}
        />
      ))}

      {nothingMatches && (
        <div className="empty-state-desc" style={{ textAlign: 'center', padding: 32 }}>{t('list.noMatch', { query })}</div>
      )}

      {viewing && (
        <PluginAssetViewer
          platformId={platformId}
          item={viewing.item}
          plugin={viewing.plugin}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

function SourceChip({ active, onClick, label, count, muted }: { active: boolean; onClick: () => void; label: string; count?: number; muted?: boolean }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`source-chip${active ? ' active' : ''}${muted ? ' muted' : ''}`}
      onClick={onClick}
    >
      {label}
      {count !== undefined && <span className="source-chip-count">{count}</span>}
    </button>
  )
}

function PluginGroup({ group, query, ownNameSet, defaultOpen, onOpen }: {
  group: PluginAssetGroup
  query: string
  ownNameSet: Set<string>
  defaultOpen: boolean
  onOpen: (item: PluginAssetItem) => void
}) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(defaultOpen)
  const [showAll, setShowAll] = useState(false)
  const searching = query.trim() !== ''
  const matched = searching ? group.items.filter(i => matchesQuery(i, query)) : group.items

  useEffect(() => { setOpen(defaultOpen) }, [defaultOpen])
  if (searching && matched.length === 0) return null

  // Searching auto-expands groups with hits
  const expanded = open || searching
  const shown = showAll || searching ? matched : matched.slice(0, PREVIEW_COUNT)
  const { plugin } = group

  return (
    <section className={`source-section source-section--plugin${plugin.enabled ? '' : ' disabled'}`}>
      <button className="source-section-header" onClick={() => setOpen(o => !o)} aria-expanded={expanded}>
        <span data-chevron={expanded ? 'open' : 'closed'}><PixelIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} /></span>
        <PixelIcon name="puzzle" size={16} />
        <span className="source-section-title">{plugin.name}</span>
        <span className="source-section-count">{searching ? `${matched.length} / ${group.items.length}` : group.items.length}</span>
        {plugin.source && <span className="badge badge-muted">{plugin.source}</span>}
        <span className="badge badge-muted">{t('sources.readOnly')}</span>
        <span className={`badge ${plugin.enabled ? 'badge-success' : 'badge-muted'}`}>
          {plugin.enabled ? t('sources.enabled') : t('sources.disabled')}
        </span>
      </button>
      {expanded && (
        <>
          <div className="item-card-grid">
            {shown.map(item => (
              <div
                key={item.id}
                className="item-card item-card--readonly"
                role="button"
                tabIndex={0}
                onClick={() => onOpen(item)}
                onKeyDown={e => { if (e.key === 'Enter') onOpen(item) }}
              >
                <div className="item-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.name}
                  {ownNameSet.has(item.name.toLowerCase()) && (
                    <span className="badge badge-muted" title={t('sources.sameNameHint')}>{t('sources.sameName')}</span>
                  )}
                </div>
                {item.detail && !item.description
                  ? <div className="item-card-filepath item-card-filepath--compact" title={item.detail}>{item.detail}</div>
                  : <CardSummary text={item.description} />}
              </div>
            ))}
          </div>
          {!searching && matched.length > PREVIEW_COUNT && (
            <button className="btn btn-ghost btn-sm source-show-all" onClick={() => setShowAll(s => !s)}>
              {showAll ? t('sources.showLess') : t('sources.showAll', { count: matched.length })}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** Read-only viewer for a plugin-provided file. */
export function PluginAssetViewer({ platformId, item, plugin, onClose }: {
  platformId: string
  item: PluginAssetItem
  plugin: PluginInfo
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!item.filePath) return
    pluginsApi.content(item.filePath, platformId).then(setContent).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [item.filePath, platformId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div className="viewer-panel" role="dialog" aria-modal="true" aria-label={item.name} onClick={e => e.stopPropagation()}>
        <div className="viewer-header">
          <div style={{ minWidth: 0 }}>
            <div className="viewer-title">{item.name}</div>
            <div className="viewer-subtitle">
              <PixelIcon name="puzzle" size={16} /> {t('sources.fromPlugin', { name: plugin.name })} · {t('sources.readOnly')}
            </div>
            {item.filePath && <div className="item-card-filepath item-card-filepath--compact" title={item.filePath}>{item.filePath}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('btn.close')}>
            <PixelIcon name="close" size={16} />
          </button>
        </div>
        {item.description && <div className="viewer-desc">{item.description}</div>}
        {item.detail && <pre className="viewer-content viewer-content--detail">{item.detail}</pre>}
        <pre className="viewer-content">
          {error ? error : content === null ? t('status.loading') : content}
        </pre>
      </div>
    </div>
  )
}
