import { AttachmentAnalysis, HeaderAnalysis, ScoreResult } from '../types/analysis'

const LEVEL = {
  safe:       { label: 'Sûr',       color: '#16a34a', bg: 'bg-[#16a34a]/8',  border: 'border-[#16a34a]/25', text: 'text-[#16a34a]' },
  suspicious: { label: 'Suspect',   color: '#d29922', bg: 'bg-[#d29922]/8',  border: 'border-[#d29922]/25', text: 'text-[#d29922]' },
  dangerous:  { label: 'Dangereux', color: '#dc2626', bg: 'bg-[#dc2626]/8',  border: 'border-[#dc2626]/25', text: 'text-[#dc2626]' },
}

const RISK_COLOR: Record<string, string> = {
  safe:       'text-[#16a34a]',
  suspicious: 'text-[#d29922]',
  dangerous:  'text-[#dc2626]',
}

const RISK_LABEL: Record<string, string> = {
  safe: 'Sûr', suspicious: 'Suspect', dangerous: 'Dangereux',
}

function AuthBadge({ label, present, pass_ }: { label: string; present: boolean; pass_: boolean | null }) {
  const ok = present && pass_ === true
  const fail = present && pass_ === false
  const color = ok ? '#16a34a' : fail ? '#dc2626' : '#6b7280'
  const icon = ok ? '✓' : fail ? '✗' : '—'
  const hint = ok ? 'Pass' : fail ? 'Fail' : 'Absent'
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">{label}</span>
      <span style={{ color }} className="text-2xl font-bold leading-none">{icon}</span>
      <span style={{ color }} className="text-xs font-semibold">{hint}</span>
    </div>
  )
}

interface Props {
  score: ScoreResult
  headerAnalysis: HeaderAnalysis
  attachmentAnalyses: AttachmentAnalysis[]
}

export default function ScoreCard({ score, headerAnalysis, attachmentAnalyses }: Props) {
  const s = LEVEL[score.level]
  const pct = score.score

  const R = 90
  const CX = 104
  const circ = 2 * Math.PI * R
  const dash = (pct / 100) * circ

  return (
    <div className={`animate-fade-up rounded-2xl border-2 ${s.border} ${s.bg} p-8`}>
      <div className="flex items-center gap-10">

        {/* Jauge circulaire */}
        <div className="relative shrink-0 w-52 h-52">
          <svg viewBox="0 0 208 208" className="w-full h-full -rotate-90">
            <circle cx={CX} cy={CX} r={R} fill="none" stroke="#c8c2b8" strokeWidth="14" />
            <circle cx={CX} cy={CX} r={R} fill="none"
              stroke={s.color} strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-6xl font-bold leading-none ${s.text}`}>{pct}</span>
            <span className={`text-base ${s.text} opacity-60 mt-1`}>/100</span>
          </div>
        </div>

        {/* Contenu droite */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Niveau */}
          <div className="flex items-center gap-3">
            <span className={`text-4xl font-bold ${s.text}`}>{s.label}</span>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${s.border} ${s.text} ${s.bg}`}>
              Score {pct}/100
            </span>
          </div>

          {/* Authentification */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-medium mb-3">Authentification</p>
            <div className="flex gap-8">
              <AuthBadge label="SPF"   present={headerAnalysis.spf.present}   pass_={headerAnalysis.spf.pass_} />
              <AuthBadge label="DKIM"  present={headerAnalysis.dkim.present}  pass_={headerAnalysis.dkim.pass_} />
              <AuthBadge label="DMARC" present={headerAnalysis.dmarc.present} pass_={headerAnalysis.dmarc.pass_} />
            </div>
          </div>

          {/* Pièces jointes */}
          {attachmentAnalyses.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-4">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-medium mb-3">Pièces jointes</p>
              <div className="space-y-1">
                {attachmentAnalyses.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text)] truncate max-w-[200px]">{a.filename}</span>
                    <span className={`font-semibold ${RISK_COLOR[a.risk]}`}>{RISK_LABEL[a.risk]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flags suspects */}
          {score.reasons.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-4">
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-medium mb-3">Facteurs de risque</p>
              <ul className="space-y-1">
                {score.reasons.map((r, i) => (
                  <li key={i} className={`text-sm flex items-start gap-2 ${s.text}`}>
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
