export const API_BASE = 'http://localhost:3001'

export async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const headers: Record<string, string> = {}
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}
