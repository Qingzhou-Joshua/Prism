import { useCallback, useEffect, useState } from 'react'
import type { Profile, PlatformId } from '@prism/shared'
import { profilesApi } from '../api/profiles'

const PLATFORM_LABELS: Record<PlatformId, string> = {
  'claude-code': 'Claude Code',
  'openclaw': 'OpenClaw',
  'codebuddy': 'CodeBuddy',
  'cursor': 'Cursor',
}

interface ProfilesPageProps {
  onNew: () => void
  onEdit: (profile: Profile) => void
}

export function ProfilesPage({ onNew, onEdit }: ProfilesPageProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const items = await profilesApi.list()
      setProfiles(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (profile: Profile) => {
    if (!confirm(`Delete profile "${profile.name}"?`)) return
    setDeletingId(profile.id)
    try {
      await profilesApi.delete(profile.id)
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: '#f0f0f0', fontSize: 20 }}>Profiles</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            Combine rules and bind them to target platforms for publishing.
          </p>
        </div>
        <button onClick={onNew} style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + New Profile
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#3b1f1f', border: '1px solid #7f1d1d', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ color: '#666', fontSize: 14 }}>Loading profiles…</div>}

      {/* Empty state */}
      {!loading && profiles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#555' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, marginBottom: 8 }}>No profiles yet</div>
          <div style={{ fontSize: 13 }}>Create a profile to bundle rules for a specific platform.</div>
        </div>
      )}

      {/* Profile list */}
      {!loading && profiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map((profile) => (
            <div key={profile.id} style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#f0f0f0', fontSize: 14, marginBottom: 4 }}>{profile.name}</div>
                {profile.description && (
                  <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{profile.description}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#666' }}>{profile.ruleIds.length} rule{profile.ruleIds.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 11, color: '#444' }}>·</span>
                  {profile.targetPlatforms.map((p) => (
                    <span key={p} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: '#1a2a4a', color: '#60a5fa', border: '1px solid #1d4ed8' }}>
                      {PLATFORM_LABELS[p]}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onEdit(profile)} style={{ padding: '5px 12px', background: '#1e3a5f', color: '#93c5fd', border: '1px solid #1d4ed8', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Edit</button>
                <button onClick={() => handleDelete(profile)} disabled={deletingId === profile.id} style={{ padding: '5px 12px', background: '#3b1f1f', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: 5, cursor: deletingId === profile.id ? 'not-allowed' : 'pointer', fontSize: 12, opacity: deletingId === profile.id ? 0.6 : 1 }}>
                  {deletingId === profile.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
