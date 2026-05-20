import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  loading: boolean
}

export default function DropZone({ onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-20 text-center transition-all duration-300
        ${dragging ? 'border-[var(--accent)] bg-[var(--accent-bg)] scale-[1.01]' : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--bg-surface)]'}
        ${loading ? 'pointer-events-none' : ''}`}
    >
      <input ref={inputRef} type="file" accept=".eml" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--accent)]/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)] animate-spin" />
          </div>
          <div>
            <p className="text-[var(--text)] font-medium">Analyse en cours</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Parsing du fichier…</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
            ${dragging ? 'bg-[var(--accent-bg)] border border-[var(--accent)]' : 'bg-[var(--bg-card)] border border-[var(--border)] group-hover:border-[var(--accent)] group-hover:bg-[var(--accent-bg)]'}`}>
            <svg className={`w-7 h-7 transition-colors duration-300 ${dragging ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover:text-[var(--accent)]'}`}
              fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
            </svg>
          </div>
          <div>
            <p className="text-[var(--text)] font-medium text-base">
              Dépose ton fichier <span className="text-[var(--accent)]">.eml</span> ici
            </p>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              ou <span className="text-[var(--accent)] underline underline-offset-2 decoration-dotted">parcourir</span> depuis ton ordinateur
            </p>
          </div>
          <div className="flex items-center gap-4 mt-2">
            {['En-têtes', 'Corps', 'Pièces jointes', 'Headers bruts'].map(t => (
              <span key={t} className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
