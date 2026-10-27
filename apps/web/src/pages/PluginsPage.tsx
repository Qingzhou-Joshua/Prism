import { PixelIcon } from '../components/PixelIcon'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { PluginAssetItem, PluginAssetType, PluginContents, PluginInfo } from '@prism/shared'
import { PLUGIN_ASSET_TYPES } from '@prism/shared'
import { pluginsApi } from '../api/plugins.js'
import { CardSummary, ListSearch, matchesQuery } from '../components/CardSummary'
import { PluginAssetViewer } from '../components/AssetSources'
import { MotionCard, FadeIn } from '../components/MotionCard'

interface PluginsPageProps {
  platformId: string
}

export function PluginsPage({ platformId }: PluginsPageProps) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PluginInfo | null>(null)
  const tNav = useTranslation('common').t

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlugins(await pluginsApi.list(platformId))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('plugins.loadingFailed'))
    } finally {
      setLoading(false)
    }
  }, [platformId, t])

  useEffect(() => { void load() }, [load])

  async function toggle(plugin: PluginInfo) {
    const impact = describeContents(plugin.contents, tNav)
    if (plugin.enabled && impact && !confirm(t('plugins.confirmDisable', { name: plugin.name, impact }))) return
    setBusyId(plugin.id)
    try {
      const updated = await pluginsApi.setEnabled(plugin.id, !plugin.enabled, platformId)
      setPlugins(prev => prev.map(p => (p.id === plugin.id ? { ...updated, contents: p.contents } : p)))
      setSelected(sel => (sel?.id === plugin.id ? { ...sel, enabled: updated.enabled } : sel))
    } catch (e) {
      alert(e instanceof Error ? e.message : t('plugins.toggleFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="loading-state">{t('plugins.title')}…</div>
  if (error) return (
    <div className="error-state">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PixelIcon name="warning" size={14} /> {error}</span>
      <button className="btn btn-ghost btn-sm" onClick={() => void load()}>{tCommon('btn.retry')}</button>
    </div>
  )

  if (selected) {
    return (
      <PluginDetail
        platformId={platformId}
        plugin={selected}
        busy={busyId === selected.id}
        onToggle={() => void toggle(selected)}
        onBack={() => setSelected(null)}
      />
    )
  }

  const q = query.trim().toLowerCase()
  const visible = q ? plugins.filter(p => p.id.toLowerCase().includes(q)) : plugins
  const enabledCount = plugins.filter(p => p.enabled).length

  return (
    <div>
      <FadeIn>
      <div className="page-header">
        <div>
          <div className="page-title">{t('plugins.title')}</div>
          <div className="page-subtitle">
            {t('plugins.count', { count: plugins.length })} · {t('plugins.enabledCount', { count: enabledCount })}
          </div>
        </div>
        {plugins.length > 6 && (
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder={t('plugins.search')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        )}
      </div>
      </FadeIn>

      {plugins.length === 0 && (
        <FadeIn delay={0.1}>
        <div className="empty-state">
          <div className="empty-state-icon"><PixelIcon name="puzzle" size={32} /></div>
          <div className="empty-state-title">{t('plugins.empty')}</div>
          <div className="empty-state-desc">{t('plugins.emptyHint')}</div>
        </div>
        </FadeIn>
      )}

      {visible.length > 0 && (
        <div className="item-card-grid">
          {visible.map((plugin, i) => (
            <MotionCard key={plugin.id} index={i} style={{ opacity: plugin.enabled ? 1 : 0.6, cursor: 'pointer' }} onClick={() => setSelected(plugin)}>
              <div className="item-card-name">{plugin.name}</div>
              <div className="plugin-contents">
                {contentEntries(plugin.contents).map(([type, n]) => (
                  <span key={type} className="badge badge-muted">{n} {tNav(`nav.${type}`)}</span>
                ))}
                {contentEntries(plugin.contents).length === 0 && <span className="item-card-date">{t('plugins.noAssets')}</span>}
              </div>
              {plugin.installPath && (
                <div className="item-card-filepath" title={plugin.installPath}>{plugin.installPath}</div>
              )}
              <div className="item-card-meta">
                {plugin.source && <span className="badge badge-muted">{plugin.source}</span>}
                {plugin.version && <span className="badge badge-muted">v{plugin.version}</span>}
                {plugin.scope && <span className="badge badge-muted">{plugin.scope}</span>}
              </div>
              <div className="item-card-footer">
                <span className="item-card-date">
                  {plugin.enabled ? t('plugins.enabled') : t('plugins.disabled')}
                </span>
                <div className="item-card-actions">
                  <label
                    onClick={e => e.stopPropagation()}
                    title={plugin.toggleable ? undefined : t('plugins.readOnly')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: plugin.toggleable ? 'pointer' : 'not-allowed' }}
                  >
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`${plugin.name} ${t('plugins.enabled')}`}
                      checked={plugin.enabled}
                      disabled={!plugin.toggleable || busyId === plugin.id}
                      onChange={() => void toggle(plugin)}
                    />
                  </label>
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      )}
    </div>
  )
}

function contentEntries(contents?: PluginContents): [PluginAssetType, number][] {
  return PLUGIN_ASSET_TYPES.filter(t => (contents?.[t] ?? 0) > 0).map(t => [t, contents![t]!])
}

function describeContents(contents: PluginContents | undefined, t: (k: string) => string): string {
  return contentEntries(contents).map(([type, n]) => `${n} ${t(`nav.${type}`)}`).join('、')
}

function PluginDetail({ platformId, plugin, busy, onToggle, onBack }: {
  platformId: string
  plugin: PluginInfo
  busy: boolean
  onToggle: () => void
  onBack: () => void
}) {
  const { t } = useTranslation('pages')
  const tCommon = useTranslation('common').t
  const types = contentEntries(plugin.contents).map(([type]) => type)
  const [tab, setTab] = useState<PluginAssetType | null>(types[0] ?? null)
  const [items, setItems] = useState<PluginAssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<PluginAssetItem | null>(null)

  useEffect(() => {
    if (!tab) return
    let cancelled = false
    setLoading(true)
    pluginsApi.assets(tab, platformId)
      .then(groups => { if (!cancelled) setItems(groups.find(g => g.plugin.id === plugin.id)?.items ?? []) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tab, platformId, plugin.id])

  const visible = items.filter(i => matchesQuery(i, query))

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>
            {tCommon('btn.back')}
          </button>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PixelIcon name="puzzle" size={32} /> {plugin.name}
          </div>
          <div className="page-subtitle">
            {[plugin.source, plugin.version && `v${plugin.version}`, plugin.scope].filter(Boolean).join(' · ')}
          </div>
          {plugin.installPath && (
            <div className="item-card-filepath" style={{ marginTop: 4 }}>{plugin.installPath}</div>
          )}
        </div>
        <label
          title={plugin.toggleable ? undefined : t('plugins.readOnly')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: plugin.toggleable ? 'pointer' : 'not-allowed' }}
        >
          <input
            type="checkbox"
            role="switch"
            aria-label={`${plugin.name} ${t('plugins.enabled')}`}
            checked={plugin.enabled}
            disabled={!plugin.toggleable || busy}
            onChange={onToggle}
          />
          {plugin.enabled ? t('plugins.enabled') : t('plugins.disabled')}
        </label>
      </div>

      {types.length === 0 ? (
        <div className="empty-state-desc" style={{ padding: 32, textAlign: 'center' }}>{t('plugins.noAssets')}</div>
      ) : (
        <>
          <div className="plugin-tabs" role="tablist">
            {contentEntries(plugin.contents).map(([type, n]) => (
              <button
                key={type}
                role="tab"
                aria-selected={tab === type}
                className={`plugin-tab${tab === type ? ' active' : ''}`}
                onClick={() => { setTab(type); setQuery('') }}
              >
                {tCommon(`nav.${type}`)} <span className="source-chip-count">{n}</span>
              </button>
            ))}
            <div style={{ marginLeft: 'auto', paddingBottom: 6 }}>
              <ListSearch value={query} onChange={setQuery} />
            </div>
          </div>
          {loading ? (
            <div className="loading-state">{tCommon('status.loading')}</div>
          ) : (
            <div className="item-card-grid">
              {visible.map(item => (
                <div
                  key={item.id}
                  className="item-card item-card--readonly"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewing(item)}
                  onKeyDown={e => { if (e.key === 'Enter') setViewing(item) }}
                >
                  <div className="item-card-name">{item.name}</div>
                  {item.detail && !item.description
                    ? <div className="item-card-filepath item-card-filepath--compact" title={item.detail}>{item.detail}</div>
                    : <CardSummary text={item.description} />}
                </div>
              ))}
            </div>
          )}
          {!loading && query && visible.length === 0 && (
            <div className="empty-state-desc" style={{ textAlign: 'center', padding: 32 }}>{tCommon('list.noMatch', { query })}</div>
          )}
        </>
      )}

      {viewing && (
        <PluginAssetViewer platformId={platformId} item={viewing} plugin={plugin} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
