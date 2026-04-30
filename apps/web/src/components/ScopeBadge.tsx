import { useTranslation } from 'react-i18next'

const SCOPE_CLASS: Record<string, string> = {
  global: 'bg-blue-100 text-blue-700 border-blue-200',
  'platform-only': 'bg-gray-100 text-gray-600 border-gray-200',
  project: 'bg-gray-100 text-gray-600 border-gray-200',
  override: 'bg-orange-100 text-orange-700 border-orange-200',
}

interface ScopeBadgeProps {
  scope: string
}

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const { t } = useTranslation('components')
  const className = SCOPE_CLASS[scope] ?? SCOPE_CLASS['global']

  // Map scope value to translation key
  const labelKey =
    scope === 'global' ? 'scopeBadge.global'
    : scope === 'override' ? 'scopeBadge.override'
    : 'scopeBadge.platformOnly'  // 'platform-only' and legacy 'project'

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}
    >
      {t(labelKey)}
    </span>
  )
}
