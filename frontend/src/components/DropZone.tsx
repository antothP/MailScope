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
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer border-2 border-dashed rounded-xl p-16 text-center transition-colors
        ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".eml"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {loading
        ? <p className="text-gray-500">Analyse en cours…</p>
        : <p className="text-gray-500">Glisse un fichier <strong>.eml</strong> ici ou clique pour sélectionner</p>
      }
    </div>
  )
}
