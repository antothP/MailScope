import { useState } from 'react'
import DropZone from '../components/DropZone'
import { analyzeEml } from '../api/client'
import { ParsedEmail } from '../types/analysis'

const C = {
  base:    'bg-[var(--bg-base)]',
  surface: 'bg-[var(--bg-surface)]',
  card:    'bg-[var(--bg-card)]',
  border:  'border-[var(--border)]',
  border2: 'border-[var(--border-2)]',
  text:    'text-[var(--text)]',
  muted:   'text-[var(--text-muted)]',
  accent:  'text-[var(--accent)]',
  accentBg:'bg-[var(--accent-bg)]',
}

export default function Dashboard() {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ParsedEmail | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'headers' | 'body'>('overview')

  async function handleFile(file: File) {
    setError(null); setResult(null); setFilename(file.name); setLoading(true)
    try { const d = await analyzeEml(file); setResult(d); setActiveTab('overview') }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${C.base}`}>

      {/* Topbar — résultats uniquement */}
      {result && (
        <header className={`animate-fade-in shrink-0 h-12 border-b ${C.border} ${C.surface} flex items-center px-6 gap-4 z-10`}>
          <div className={`flex items-center gap-2 ${C.muted}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
            </svg>
            <span className="text-xs font-mono">{filename}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => { setResult(null); setFilename(null); setError(null) }}
              className={`text-xs ${C.accent} transition-colors flex items-center gap-1.5 border ${C.border} hover:${C.border2} px-3 py-1.5 rounded-lg`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
              Nouvelle analyse
            </button>
          </div>
        </header>
      )}

      {/* Page d'accueil */}
      {!result && !loading ? (
        <div className="flex-1 flex items-center">
          {/* Image gauche */}
          <div className="hidden lg:flex w-[653px] shrink-0 items-center justify-center px-4 py-6">
            <img src="/fisher.png" alt="" className="w-full h-auto object-contain opacity-90" />
          </div>

          {/* Contenu centré — flex-1 pour occuper tout l'espace restant */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-8">
          <div className="animate-fade-up text-center space-y-3">
            <div className="flex items-center justify-center gap-5 mb-2">
              <img src="/logo.png" alt="MailScope" className="h-24 w-24 object-contain" />
              <span className={`font-brand text-8xl ${C.text} leading-none`}>MailScope</span>
            </div>
          </div>

          <div className="animate-fade-up delay-1 w-full max-w-2xl">
            <DropZone onFile={handleFile} loading={loading} />
          </div>

          {error && (
            <div className="animate-fade-up flex items-center gap-2.5 bg-[#f85149]/8 border border-[#f85149]/25 text-[#f85149] rounded-xl px-4 py-3 text-sm max-w-2xl w-full">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}
          </div>

          {/* Espace miroir pour garder le contenu centré */}
          <div className="hidden lg:block w-[653px] shrink-0" />
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <DropZone onFile={handleFile} loading={true} />
        </div>
      ) : result ? (
        <ResultDashboard result={result!} activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : null}
    </div>
  )
}

/* ─── Dashboard résultats ─── */

function ResultDashboard({ result, activeTab, setActiveTab }: {
  result: ParsedEmail
  activeTab: 'overview' | 'headers' | 'body'
  setActiveTab: (t: 'overview' | 'headers' | 'body') => void
}) {
  const headerCount = Object.keys(result.headers).length
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className={`border-b ${C.border} ${C.surface} px-6 flex items-center gap-1`}>
        {([
          { id: 'overview', label: 'Vue générale' },
          { id: 'headers',  label: `Headers bruts (${headerCount})` },
          { id: 'body',     label: 'Corps du message' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150
              ${activeTab === tab.id ? `border-[var(--accent)] ${C.accent}` : `border-transparent ${C.muted} hover:${C.text}`}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && <OverviewTab result={result} />}
        {activeTab === 'headers'  && <HeadersTab  result={result} />}
        {activeTab === 'body'     && <BodyTab      result={result} />}
      </div>
    </div>
  )
}

/* ─── Onglet Vue générale ─── */

function OverviewTab({ result }: { result: ParsedEmail }) {
  return (
    <div className="grid grid-cols-12 gap-4 max-w-7xl mx-auto">
      <div className="col-span-12 lg:col-span-8 space-y-4">

        <div className={`animate-fade-up rounded-xl border ${C.border} ${C.surface} p-5`}>
          <label className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Objet</label>
          <p className={`mt-2 ${C.text} text-xl font-semibold leading-snug`}>
            {result.subject ?? <span className={`${C.muted} italic font-normal`}>(sans objet)</span>}
          </p>
        </div>

        <div className="animate-fade-up delay-1 grid grid-cols-2 gap-4">
          {[
            { label: 'Expéditeur', value: result.sender ?? '—', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
            { label: 'Destinataires', value: result.recipients.join(', ') || '—', icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
          ].map(({ label, value, icon }) => (
            <div key={label} className={`rounded-xl border ${C.border} ${C.surface} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-7 h-7 rounded-lg ${C.accentBg} flex items-center justify-center`}>
                  <svg className={`w-3.5 h-3.5 ${C.accent}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon}/>
                  </svg>
                </div>
                <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>{label}</span>
              </div>
              <p className={`${C.text} text-sm font-medium break-all`}>{value}</p>
            </div>
          ))}
        </div>

        <div className={`animate-fade-up delay-2 rounded-xl border ${C.border} ${C.surface} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#d29922]/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#d29922]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/>
              </svg>
            </div>
            <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Aperçu du corps</span>
            <div className="ml-auto flex gap-1.5">
              {result.body_text && <Badge label="Texte" color="yellow" />}
              {result.body_html && <Badge label="HTML" color="blue" />}
            </div>
          </div>
          {result.body_text
            ? <pre className={`${C.muted} text-sm font-sans leading-relaxed whitespace-pre-wrap break-words line-clamp-6 overflow-hidden`}>{result.body_text}</pre>
            : <p className={`${C.muted} text-sm italic`}>Aucun corps texte</p>}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className={`animate-slide-right rounded-xl border ${C.border} ${C.surface} p-4`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#a371f7]/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#a371f7]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
              </svg>
            </div>
            <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Date d'envoi</span>
          </div>
          <p className={`${C.text} text-sm font-medium`}>{result.date ?? '—'}</p>
        </div>

        <div className={`animate-slide-right delay-1 rounded-xl border ${C.border} ${C.surface} p-4 space-y-3`}>
          <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Statistiques</span>
          <div className="space-y-2 mt-2">
            <StatRow label="Headers"        value={String(Object.keys(result.headers).length)} />
            <StatRow label="Destinataires"  value={String(result.recipients.length)} />
            <StatRow label="Pièces jointes" value={String(result.attachments.length)} />
            <StatRow label="Corps texte"    value={result.body_text ? `${result.body_text.length} car.` : 'Aucun'} />
            <StatRow label="Corps HTML"     value={result.body_html ? 'Présent' : 'Absent'} />
          </div>
        </div>

        {result.attachments.length > 0 && (
          <div className={`animate-slide-right delay-2 rounded-xl border ${C.border} ${C.surface} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#f85149]/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#f85149]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                </svg>
              </div>
              <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Pièces jointes</span>
            </div>
            <div className="space-y-2">
              {result.attachments.map((a, i) => (
                <div key={i} className={`flex items-center gap-2.5 rounded-lg ${C.card} border ${C.border} px-3 py-2`}>
                  <div className={`w-7 h-7 rounded-md ${C.base} border ${C.border2} flex items-center justify-center shrink-0`}>
                    <FileIcon mime={a.content_type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`${C.text} text-xs font-medium truncate`}>{a.filename}</p>
                    <p className={`${C.muted} text-xs`}>{(a.size / 1024).toFixed(1)} Ko</p>
                  </div>
                  <MimeBadge mime={a.content_type} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Onglet Headers bruts ─── */

function HeadersTab({ result }: { result: ParsedEmail }) {
  const important = ['From','To','Cc','Bcc','Subject','Date','Message-ID','Reply-To','Return-Path','Received']
  const sorted = Object.entries(result.headers).sort(([a], [b]) => {
    const ai = important.indexOf(a), bi = important.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.localeCompare(b)
  })
  return (
    <div className="max-w-5xl mx-auto animate-fade-up">
      <div className={`rounded-xl border ${C.border} ${C.surface} overflow-hidden`}>
        <div className={`px-4 py-3 border-b ${C.border} ${C.card}`}>
          <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>{sorted.length} headers</span>
        </div>
        <div className={`divide-y divide-[var(--border)]`}>
          {sorted.map(([k, v], i) => (
            <div key={i} className={`flex gap-4 px-4 py-2.5 hover:${C.card} transition-colors`}>
              <span className={`text-xs font-mono w-40 shrink-0 pt-0.5 truncate ${important.includes(k) ? C.accent : C.muted}`}>{k}</span>
              <span className={`text-xs font-mono ${C.text} break-all leading-relaxed`}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Onglet Corps ─── */

function BodyTab({ result }: { result: ParsedEmail }) {
  const [view, setView] = useState<'text' | 'html'>('text')
  return (
    <div className="max-w-5xl mx-auto animate-fade-up space-y-4">
      <div className="flex gap-2">
        {result.body_text && (
          <button onClick={() => setView('text')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
              ${view === 'text' ? `border-[var(--accent)] ${C.accent} ${C.accentBg}` : `${C.border} ${C.muted}`}`}>
            Texte brut
          </button>
        )}
        {result.body_html && (
          <button onClick={() => setView('html')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
              ${view === 'html' ? `border-[var(--accent)] ${C.accent} ${C.accentBg}` : `${C.border} ${C.muted}`}`}>
            HTML source
          </button>
        )}
      </div>
      <div className={`rounded-xl border ${C.border} ${C.surface} p-5`}>
        {view === 'text' && result.body_text && (
          <pre className={`text-sm ${C.text} font-sans leading-relaxed whitespace-pre-wrap break-words`}>{result.body_text}</pre>
        )}
        {view === 'html' && result.body_html && (
          <pre className={`text-xs ${C.muted} font-mono leading-relaxed whitespace-pre-wrap break-all overflow-auto`}>{result.body_html}</pre>
        )}
        {!result.body_text && !result.body_html && (
          <p className={`${C.muted} text-sm italic`}>Aucun corps de message</p>
        )}
      </div>
    </div>
  )
}

/* ─── Petits composants ─── */

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${C.muted} text-xs`}>{label}</span>
      <span className={`${C.text} text-xs font-medium font-mono`}>{value}</span>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'yellow' | 'blue' | 'green' }) {
  const cls = {
    yellow: 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/20',
    blue:   'bg-[#4493f8]/10 text-[#4493f8] border-[#4493f8]/20',
    green:  'bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/20',
  }[color]
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>{label}</span>
}

function MimeBadge({ mime }: { mime: string }) {
  const short = mime.split('/')[1]?.split(';')[0] ?? mime
  return (
    <span className={`text-[10px] ${C.muted} ${C.base} border ${C.border2} px-1.5 py-0.5 rounded font-mono shrink-0`}>
      {short}
    </span>
  )
}

function FileIcon({ mime }: { mime: string }) {
  const color = mime.startsWith('image/') ? 'text-[#3fb950]'
    : mime.includes('pdf') ? 'text-[#f85149]'
    : mime.includes('word') || mime.includes('document') ? C.accent
    : C.muted
  return (
    <svg className={`w-3.5 h-3.5 ${color}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
    </svg>
  )
}
