import type { AssetSummary, PluginAssetGroup, PluginAssetType, PluginInfo } from '@prism/shared'
import { request } from './client.js'

function platformQuery(platform?: string): string {
  return platform ? `?platform=${encodeURIComponent(platform)}` : ''
}

export const pluginsApi = {
  list(platform?: string): Promise<PluginInfo[]> {
    return request<{ items: PluginInfo[] }>(`/plugins${platformQuery(platform)}`).then(r => r?.items ?? [])
  },

  assets(type: PluginAssetType, platform?: string): Promise<PluginAssetGroup[]> {
    const q = platform ? `&platform=${encodeURIComponent(platform)}` : ''
    return request<{ groups: PluginAssetGroup[] }>(`/plugin-assets?type=${type}${q}`).then(r => r?.groups ?? [])
  },

  content(path: string, platform?: string): Promise<string> {
    const q = platform ? `&platform=${encodeURIComponent(platform)}` : ''
    return request<{ content: string }>(`/plugin-assets/content?path=${encodeURIComponent(path)}${q}`).then(r => r?.content ?? '')
  },

  summary(platform?: string): Promise<AssetSummary> {
    return request<AssetSummary>(`/assets/summary${platformQuery(platform)}`).then(r => r ?? { own: {}, plugins: {} })
  },

  setEnabled(id: string, enabled: boolean, platform?: string): Promise<PluginInfo> {
    return request<PluginInfo>(`/plugins/enabled${platformQuery(platform)}`, {
      method: 'PUT',
      body: JSON.stringify({ id, enabled }),
    }).then(r => r!)
  },
}
