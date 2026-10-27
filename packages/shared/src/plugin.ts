import type { PlatformId } from './platform.js'

/** A plugin/extension installed into a platform (read from its native config). */
export interface PluginInfo {
  /** Stable id within the platform, e.g. `figma@claude-plugins-official`. */
  id: string
  name: string
  /** Marketplace / source the plugin came from, if known. */
  source?: string
  version?: string
  scope?: string
  installPath?: string
  enabled: boolean
  /** Whether Prism can toggle `enabled` for this plugin on this platform. */
  toggleable: boolean
  platformId: PlatformId
  /** How many assets of each type the plugin contributes. */
  contents?: PluginContents
}

/** Asset types a plugin can contribute (what the platform's plugin loader reads). */
export type PluginAssetType = 'skills' | 'agents' | 'commands' | 'mcp' | 'hooks'

export const PLUGIN_ASSET_TYPES: PluginAssetType[] = ['skills', 'agents', 'commands', 'mcp', 'hooks']

/** One read-only asset provided by a plugin (list view — no body content). */
export interface PluginAssetItem {
  id: string
  name: string
  description?: string
  /** Extra one-line detail, e.g. MCP command/url or hook event + command. */
  detail?: string
  /** Source file; used to fetch content for the read-only viewer. */
  filePath?: string
}

export interface PluginAssetGroup {
  plugin: PluginInfo
  items: PluginAssetItem[]
}

export type PluginContents = Partial<Record<PluginAssetType, number>>

/** Own (user-level) vs plugin-provided asset counts for one platform. */
export interface AssetSummary {
  own: Partial<Record<PluginAssetType | 'rules', number>>
  /** Counts from enabled plugins only. */
  plugins: PluginContents
}
