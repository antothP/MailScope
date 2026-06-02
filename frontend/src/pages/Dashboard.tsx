import { useState } from 'react'
import DropZone from '../components/DropZone'
import ScoreCard from '../components/ScoreCard'
import { analyzeEml } from '../api/client'
import { AnalyzeResponse, AttachmentAnalysis, HeaderAnalysis, ParsedEmail, ScoreResult } from '../types/analysis'
import { useExportPdf } from '../hooks/useExportPdf'

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
  const [result, setResult]     = useState<AnalyzeResponse | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'auth' | 'headers' | 'body'>('overview')

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
        <ResultDashboard result={result!.email} headerAnalysis={result!.header_analysis} attachmentAnalyses={result!.attachment_analyses} score={result!.score} fullData={result!} emailFilename={filename ?? undefined} activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : null}
    </div>
  )
}

/* ─── Dashboard résultats ─── */

function ResultDashboard({ result, headerAnalysis, attachmentAnalyses, score, fullData, emailFilename, activeTab, setActiveTab }: {
  result: ParsedEmail
  headerAnalysis: HeaderAnalysis
  attachmentAnalyses: AttachmentAnalysis[]
  score: ScoreResult
  fullData: AnalyzeResponse
  emailFilename?: string
  activeTab: 'overview' | 'headers' | 'body' | 'auth'
  setActiveTab: (t: 'overview' | 'headers' | 'body' | 'auth') => void
}) {
  const headerCount = Object.keys(result.headers).length
  const flagCount   = headerAnalysis.suspicious_flags.length
  const { exportPdf, exporting } = useExportPdf()

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className={`border-b ${C.border} ${C.surface} px-6 flex items-center gap-1`}>
        {([
          { id: 'overview', label: 'Vue générale' },
          { id: 'auth',     label: 'Authentification', badge: flagCount > 0 ? flagCount : null },
          { id: 'headers',  label: `Headers bruts (${headerCount})` },
          { id: 'body',     label: 'Corps du message' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 flex items-center gap-2
              ${activeTab === tab.id ? `border-[var(--accent)] ${C.accent}` : `border-transparent ${C.muted} hover:${C.text}`}`}>
            {tab.label}
            {'badge' in tab && tab.badge !== null && (
              <span className="bg-[#dc2626] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <button onClick={() => exportPdf(fullData, emailFilename)} disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors duration-150
              ${C.border} ${C.muted} hover:${C.text} disabled:opacity-50`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? 'Export…' : 'Exporter PDF'}
          </button>
        </div>
      </div>
      <div id="pdf-export-target" className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && <OverviewTab result={result} headerAnalysis={headerAnalysis} attachmentAnalyses={attachmentAnalyses} score={score} />}
        {activeTab === 'auth'     && <AuthTab headerAnalysis={headerAnalysis} />}
        {activeTab === 'headers'  && <HeadersTab result={result} />}
        {activeTab === 'body'     && <BodyTab result={result} />}
      </div>
    </div>
  )
}

/* ─── Onglet Vue générale ─── */

function OverviewTab({ result, headerAnalysis, attachmentAnalyses, score }: { result: ParsedEmail; headerAnalysis: HeaderAnalysis; attachmentAnalyses: AttachmentAnalysis[]; score: ScoreResult }) {
  return (
    <div className="grid grid-cols-12 gap-4 max-w-7xl mx-auto">

      {/* Score card pleine largeur */}
      <div className="col-span-12">
        <ScoreCard score={score} headerAnalysis={headerAnalysis} attachmentAnalyses={attachmentAnalyses} />
      </div>

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

        {/* ── Pièces jointes (pleine largeur colonne gauche) ── */}
        {attachmentAnalyses.length > 0 && (
          <div className={`animate-fade-up delay-3 rounded-xl border ${C.border} ${C.surface} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#f85149]/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#f85149]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                </svg>
              </div>
              <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>
                Pièces jointes ({attachmentAnalyses.length})
              </span>
            </div>
            <div className="space-y-3">
              {attachmentAnalyses.map((a, i) => {
                const riskStyle = {
                  safe:       { border: C.border,              bg: C.card,          badge: 'bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/20', label: 'Sûr' },
                  suspicious: { border: 'border-[#d29922]/40', bg: 'bg-[#d29922]/5', badge: 'bg-[#d29922]/10 text-[#d29922] border-[#d29922]/20', label: 'Suspect' },
                  dangerous:  { border: 'border-[#dc2626]/40', bg: 'bg-[#dc2626]/5', badge: 'bg-[#dc2626]/10 text-[#dc2626] border-[#dc2626]/20', label: 'Dangereux' },
                }[a.risk]
                return (
                  <div key={i} className={`rounded-lg border ${riskStyle.border} ${riskStyle.bg} p-4`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-lg ${C.base} border ${C.border2} flex items-center justify-center shrink-0`}>
                        <FileIcon mime={a.real_mime} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`${C.text} text-sm font-semibold truncate`}>{a.filename}</p>
                        <p className={`${C.muted} text-xs`}>{(a.size / 1024).toFixed(1)} Ko · {a.extension || 'sans extension'}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${riskStyle.badge}`}>
                        {riskStyle.label}
                      </span>
                    </div>

                    {/* Comparaison type déclaré vs réel */}
                    <div className={`rounded-lg ${C.base} border ${C.border} grid grid-cols-2`}>
                      <div className="px-4 py-3">
                        <p className={`${C.muted} text-[10px] uppercase tracking-widest mb-1`}>Type déclaré</p>
                        <p className={`text-sm font-mono ${C.text}`}>{a.declared_mime}</p>
                      </div>
                      <div className={`px-4 py-3 border-l ${C.border}`}>
                        <p className={`text-[10px] uppercase tracking-widest mb-1 ${a.mime_mismatch ? 'text-[#dc2626]' : C.muted}`}>
                          Type réel (magic bytes)
                        </p>
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-mono font-semibold ${a.mime_mismatch ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                            {a.real_mime}
                          </p>
                          <span className={`text-base font-bold ${a.mime_mismatch ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                            {a.mime_mismatch ? '✗' : '✓'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {(a.has_macros || a.has_js_in_pdf || a.double_extension) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {a.has_macros && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-[#dc2626]/10 text-[#dc2626] border border-[#dc2626]/20 font-medium">
                            Macros VBA{a.macro_details.length > 0 ? ` · ${a.macro_details.join(', ')}` : ''}
                          </span>
                        )}
                        {a.has_js_in_pdf && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-[#dc2626]/10 text-[#dc2626] border border-[#dc2626]/20 font-medium">
                            JavaScript dans PDF
                          </span>
                        )}
                        {a.double_extension && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20 font-medium">
                            Double extension
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
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

      </div>
    </div>
  )
}

/* ─── Onglet Authentification ─── */

function AuthTab({ headerAnalysis: h }: { headerAnalysis: HeaderAnalysis }) {
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-up">

      {/* Flags suspects */}
      {h.suspicious_flags.length > 0 && (
        <div className="rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-[#dc2626]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
            <span className="text-[#dc2626] text-xs font-semibold uppercase tracking-widest">
              {h.suspicious_flags.length} indicateur{h.suspicious_flags.length > 1 ? 's' : ''} suspect{h.suspicious_flags.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1.5">
            {h.suspicious_flags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#dc2626]">
                <span className="mt-1 shrink-0">•</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SPF / DKIM / DMARC */}
      <div className={`rounded-xl border ${C.border} ${C.surface} p-4`}>
        <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Authentification</span>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <AuthCard label="SPF"   result={h.spf} />
          <AuthCard label="DKIM"  result={h.dkim} />
          <AuthCard label="DMARC" result={h.dmarc} />
        </div>
      </div>

      {/* Identité */}
      <div className={`rounded-xl border ${C.border} ${C.surface} p-4 space-y-2`}>
        <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>Identité</span>
        <div className="mt-3 space-y-2">
          <InfoRow label="Message-ID"   value={h.message_id} />
          <InfoRow label="Return-Path"  value={h.return_path} />
          {h.reply_to && (
            <InfoRow
              label="Reply-To"
              value={h.reply_to.address}
              warn={h.reply_to.differs_from_sender}
              warnMsg="Domaine différent de l'expéditeur"
            />
          )}
          <InfoRow label="IP d'origine" value={h.x_originating_ip} />
        </div>
      </div>

      {/* Hops Received */}
      {h.received_hops.length > 0 && (
        <div className={`rounded-xl border ${C.border} ${C.surface} p-4`}>
          <span className={`${C.muted} text-xs uppercase tracking-widest font-medium`}>
            Chemin de routage ({h.received_hops.length} hop{h.received_hops.length > 1 ? 's' : ''})
          </span>
          <div className="mt-3 space-y-2">
            {h.received_hops.map((hop, i) => (
              <div key={i} className={`rounded-lg ${C.card} border ${C.border} px-3 py-2.5`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold ${C.muted} bg-[var(--bg-surface)] border ${C.border} px-1.5 py-0.5 rounded`}>
                    #{i + 1}
                  </span>
                  {hop.timestamp && <span className={`text-xs ${C.muted}`}>{hop.timestamp}</span>}
                </div>
                <div className="space-y-0.5">
                  {hop.from_ && <p className="text-xs font-mono text-[var(--text)]"><span className={`${C.muted}`}>from </span>{hop.from_}</p>}
                  {hop.by    && <p className="text-xs font-mono text-[var(--text)]"><span className={`${C.muted}`}>by   </span>{hop.by}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AuthCard({ label, result }: { label: string; result: { present: boolean; pass_: boolean | null } }) {
  const state = !result.present ? 'absent' : result.pass_ === true ? 'pass' : result.pass_ === false ? 'fail' : 'unknown'
  const styles = {
    pass:    { bg: 'bg-[#16a34a]/10 border-[#16a34a]/30', text: 'text-[#16a34a]', icon: '✓', label: 'Passé' },
    fail:    { bg: 'bg-[#dc2626]/10 border-[#dc2626]/30', text: 'text-[#dc2626]', icon: '✗', label: 'Échoué' },
    absent:  { bg: `${C.surface} ${C.border}`,            text: C.muted,          icon: '—', label: 'Absent' },
    unknown: { bg: 'bg-[#d29922]/10 border-[#d29922]/30', text: 'text-[#d29922]', icon: '?', label: 'Inconnu' },
  }[state]

  return (
    <div className={`rounded-lg border p-3 text-center ${styles.bg}`}>
      <p className={`text-2xl font-bold ${styles.text}`}>{styles.icon}</p>
      <p className={`text-xs font-semibold mt-1 ${styles.text}`}>{label}</p>
      <p className={`text-xs mt-0.5 ${styles.text} opacity-80`}>{styles.label}</p>
    </div>
  )
}

function InfoRow({ label, value, warn, warnMsg }: {
  label: string
  value: string | null | undefined
  warn?: boolean
  warnMsg?: string
}) {
  if (!value) return null
  return (
    <div className="flex gap-3 items-start">
      <span className={`${C.muted} text-xs w-28 shrink-0 pt-0.5`}>{label}</span>
      <div className="min-w-0">
        <span className={`text-xs font-mono break-all ${warn ? 'text-[#d29922]' : C.text}`}>{value}</span>
        {warn && warnMsg && (
          <span className="ml-2 text-[10px] text-[#d29922] bg-[#d29922]/10 border border-[#d29922]/20 px-1.5 py-0.5 rounded-full">{warnMsg}</span>
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
  const [view, setView] = useState<'render' | 'text' | 'source'>(
    result.body_html ? 'render' : 'text'
  )

  const hasHtml = !!result.body_html
  const hasText = !!result.body_text

  const tabs = [
    hasHtml && { id: 'render', label: 'Aperçu' },
    hasText && { id: 'text',   label: 'Texte brut' },
    hasHtml && { id: 'source', label: 'Source HTML' },
  ].filter(Boolean) as { id: string; label: string }[]

  return (
    <div className="max-w-5xl mx-auto animate-fade-up space-y-4">

      {/* Barre de sélection de vue */}
      {tabs.length > 1 && (
        <div className={`flex gap-1 p-1 rounded-xl border ${C.border} ${C.surface} w-fit`}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setView(t.id as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150
                ${view === t.id ? `bg-[var(--bg-card)] ${C.text} shadow-sm border ${C.border}` : `${C.muted} hover:${C.text}`}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Aperçu HTML rendu dans sandbox */}
      {view === 'render' && result.body_html && (
        <div className={`rounded-xl border ${C.border} overflow-hidden`}>
          <div className={`px-4 py-2 border-b ${C.border} ${C.surface} flex items-center gap-2`}>
            <span className="w-3 h-3 rounded-full bg-[#dc2626]/40" />
            <span className="w-3 h-3 rounded-full bg-[#d29922]/40" />
            <span className="w-3 h-3 rounded-full bg-[#16a34a]/40" />
            <span className={`ml-2 text-xs ${C.muted}`}>Rendu HTML — sandbox (scripts désactivés)</span>
          </div>
          <iframe
            sandbox="allow-same-origin"
            srcDoc={result.body_html}
            className="w-full bg-white"
            style={{ minHeight: '480px', border: 'none' }}
            title="Corps du message"
          />
        </div>
      )}

      {/* Texte brut formaté */}
      {view === 'text' && result.body_text && (
        <div className={`rounded-xl border ${C.border} ${C.surface} p-6`}>
          <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${C.border}`}>
            <svg className={`w-4 h-4 ${C.muted}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <span className={`text-xs font-medium ${C.muted} uppercase tracking-widest`}>Texte brut</span>
          </div>
          <div className={`text-sm ${C.text} leading-relaxed whitespace-pre-wrap break-words font-sans`}>
            {result.body_text}
          </div>
        </div>
      )}

      {/* Source HTML avec coloration */}
      {view === 'source' && result.body_html && (
        <div className={`rounded-xl border ${C.border} overflow-hidden`}>
          <div className={`px-4 py-2 border-b ${C.border} ${C.surface} flex items-center gap-2`}>
            <svg className={`w-4 h-4 ${C.muted}`} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <span className={`text-xs font-medium ${C.muted} uppercase tracking-widest`}>Source HTML</span>
            <span className={`ml-auto text-xs ${C.muted}`}>{result.body_html.length} caractères</span>
          </div>
          <pre className={`text-xs font-mono leading-relaxed whitespace-pre-wrap break-all overflow-auto p-5 ${C.surface}`}
            style={{ color: 'var(--text-muted)', maxHeight: '520px' }}>
            {result.body_html}
          </pre>
        </div>
      )}

      {!hasHtml && !hasText && (
        <div className={`rounded-xl border ${C.border} ${C.surface} p-10 text-center`}>
          <p className={`${C.muted} text-sm italic`}>Aucun corps de message</p>
        </div>
      )}
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
