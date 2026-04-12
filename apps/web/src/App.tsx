import { useEffect, useState } from 'react'

type PlatformItem = {
  id: string
  displayName: string
  detected: boolean
  configPath?: string
  message?: string
  capabilities: {
    rules: boolean
    profiles: boolean
  }
}

export function App() {
  const [items, setItems] = useState<PlatformItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlatforms = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('http://localhost:3001/platforms')

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setItems(data.items ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlatforms()
  }, [])

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Prism · v0.1.0</p>
        <h1>Local-first AI config control plane</h1>
        <p className="subtitle">
          Scan platforms, manage shared rules, preview projections, and publish safely.
        </p>
      </section>

      <section className="panel toolbar">
        <div>
          <h2>Platform Scanner</h2>
          <p className="muted">Current wave: OpenClaw + CodeBuddy</p>
        </div>
        <button className="action-button" onClick={() => void loadPlatforms()}>
          Rescan
        </button>
      </section>

      {loading ? <p className="status">Scanning platforms...</p> : null}
      {error ? <p className="status error">Failed to load platforms: {error}</p> : null}

      <section className="panel-grid">
        {items.map((item) => (
          <article className="panel" key={item.id}>
            <div className="panel-header">
              <h2>{item.displayName}</h2>
              <span className={item.detected ? 'badge success' : 'badge muted'}>
                {item.detected ? 'Detected' : 'Not detected'}
              </span>
            </div>

            <ul className="detail-list">
              <li>
                <strong>Platform ID:</strong> {item.id}
              </li>
              <li>
                <strong>Rules:</strong> {item.capabilities.rules ? 'Yes' : 'No'}
              </li>
              <li>
                <strong>Profiles:</strong> {item.capabilities.profiles ? 'Yes' : 'No'}
              </li>
              <li>
                <strong>Config Path:</strong> {item.configPath ?? 'N/A'}
              </li>
              <li>
                <strong>Status:</strong> {item.message ?? 'No message'}
              </li>
            </ul>
          </article>
        ))}
      </section>
    </main>
  )
}
