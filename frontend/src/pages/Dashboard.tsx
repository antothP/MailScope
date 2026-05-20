import { useState } from 'react'
import DropZone from '../components/DropZone'
import { analyzeEml } from '../api/client'
import { ParsedEmail } from '../types/analysis'

export default function Dashboard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParsedEmail | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      setResult(await analyzeEml(file))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold">MailScope</h1>
      <DropZone onFile={handleFile} loading={loading} />

      {error && <p className="text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4 text-sm">
          <Section title="En-têtes">
            <Field label="De" value={result.sender} />
            <Field label="À" value={result.recipients.join(', ')} />
            <Field label="Objet" value={result.subject} />
            <Field label="Date" value={result.date} />
          </Section>

          {result.body_text && (
            <Section title="Corps (texte)">
              <pre className="whitespace-pre-wrap break-words text-gray-700">{result.body_text}</pre>
            </Section>
          )}

          {result.attachments.length > 0 && (
            <Section title={`Pièces jointes (${result.attachments.length})`}>
              {result.attachments.map((a, i) => (
                <div key={i} className="flex justify-between border-b py-1">
                  <span>{a.filename}</span>
                  <span className="text-gray-400">{a.content_type} — {(a.size / 1024).toFixed(1)} Ko</span>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 w-16 shrink-0">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  )
}
