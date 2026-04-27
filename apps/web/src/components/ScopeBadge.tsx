const scopeConfig: Record<string, { label: string; className: string }> = {
  global: { label: '全局', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  'platform-only': { label: '平台独有', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  // 兼容旧值 'project'
  project: { label: '平台独有', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  override: { label: 'Override', className: 'bg-orange-100 text-orange-700 border-orange-200' },
}

interface ScopeBadgeProps {
  scope: string
}

export function ScopeBadge({ scope }: ScopeBadgeProps) {
  const config = scopeConfig[scope] ?? scopeConfig['global']
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  )
}
