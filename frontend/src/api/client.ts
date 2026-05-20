import { ParsedEmail } from '../types/analysis'

export async function analyzeEml(file: File): Promise<ParsedEmail> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch('/api/analyze', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Erreur serveur')
  }
  return res.json()
}
