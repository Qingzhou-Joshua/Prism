import { useTranslation } from 'react-i18next'

/** SkillHub-style summary: the asset's description, clamped to 3 lines on list cards. */
export function CardSummary({ text }: { text?: string }) {
  const { t } = useTranslation('common')
  const summary = text?.trim()
  if (!summary) {
    return <div className="item-card-desc item-card-desc--empty">{t('list.noDescription')}</div>
  }
  return <div className="item-card-desc" title={summary}>{summary}</div>
}

/** Case-insensitive filter over name + description. */
export function matchesQuery(item: { name: string; description?: string }, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return item.name.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q)
}

export function ListSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('common')
  return (
    <input
      type="search"
      className="form-input list-search"
      placeholder={t('list.search')}
      aria-label={t('list.search')}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}
