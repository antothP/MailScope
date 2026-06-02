import { useCallback, useState } from 'react'
import jsPDF from 'jspdf'
import { AnalyzeResponse } from '../types/analysis'

const COLORS = {
  safe:       [22, 163, 74]  as [number,number,number],
  suspicious: [210, 153, 34] as [number,number,number],
  dangerous:  [220, 38, 38]  as [number,number,number],
  bg:         [232, 226, 217] as [number,number,number],
  card:       [240, 236, 229] as [number,number,number],
  border:     [200, 194, 184] as [number,number,number],
  text:       [26, 29, 35]   as [number,number,number],
  muted:      [107, 114, 128] as [number,number,number],
  accent:     [220, 38, 38]  as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
}

const LEVEL_LABEL: Record<string, string> = {
  safe: 'SÛR', suspicious: 'SUSPECT', dangerous: 'DANGEREUX',
}

function authLabel(present: boolean, pass_: boolean | null): string {
  if (!present) return 'Absent'
  if (pass_ === true) return 'Pass'
  if (pass_ === false) return 'Fail'
  return '?'
}
function authColor(present: boolean, pass_: boolean | null): [number,number,number] {
  if (!present) return COLORS.muted
  if (pass_ === true) return COLORS.safe
  return COLORS.dangerous
}

export function useExportPdf(filename = 'mailscope-rapport.pdf') {
  const [exporting, setExporting] = useState(false)

  const exportPdf = useCallback(async (data: AnalyzeResponse, emailFilename?: string) => {
    setExporting(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210
      let y = 0

      // ─── helpers ───────────────────────────────────────────
      function fillRect(x: number, yy: number, w: number, h: number, color: [number,number,number]) {
        doc.setFillColor(...color); doc.rect(x, yy, w, h, 'F')
      }
      function text(str: string, x: number, yy: number, size: number,
        color: [number,number,number], align: 'left'|'center'|'right' = 'left', bold = false) {
        doc.setFontSize(size)
        doc.setTextColor(...color)
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.text(str, x, yy, { align })
      }
      function line(yy: number) {
        doc.setDrawColor(...COLORS.border)
        doc.setLineWidth(0.3)
        doc.line(14, yy, W - 14, yy)
      }
      function sectionTitle(label: string, yy: number): number {
        text(label.toUpperCase(), 14, yy, 7.5, COLORS.muted, 'left', false)
        line(yy + 2)
        return yy + 8
      }
      function badge(label: string, x: number, yy: number, color: [number,number,number]) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        const tw = doc.getTextWidth(label)
        const pad = 2.5
        fillRect(x, yy - 4, tw + pad * 2, 5.5, color.map(c => Math.min(255, c + 180)) as [number,number,number])
        doc.setTextColor(...color)
        doc.text(label, x + pad, yy)
      }

      // ─── HEADER ────────────────────────────────────────────
      fillRect(0, 0, W, 28, COLORS.accent)
      text('MailScope', 14, 16, 22, COLORS.white, 'left', true)
      text('Rapport d\'analyse', 14, 23, 9, [255, 200, 200])
      text(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        W - 14, 16, 9, [255,200,200], 'right')
      if (emailFilename) text(emailFilename, W - 14, 23, 8, [255,200,200], 'right')
      y = 36

      // ─── SCORE CARD ─────────────────────────────────────────
      const { score } = data
      const lvlColor = COLORS[score.level]
      const bgLight = lvlColor.map(c => Math.min(255, c + 185)) as [number,number,number]
      const filteredReasons = score.reasons.filter(r => !/spf|dkim|dmarc/i.test(r))
      const cardH = 20 + Math.max(0, filteredReasons.length) * 5 + 8
      fillRect(14, y, W - 28, cardH, bgLight)
      doc.setDrawColor(...lvlColor); doc.setLineWidth(0.5)
      doc.rect(14, y, W - 28, cardH)
      text(String(score.score), 38, y + 14, 28, lvlColor, 'center', true)
      text('/100', 38, y + 21, 7, lvlColor, 'center')
      text(LEVEL_LABEL[score.level], 60, y + 13, 18, lvlColor, 'left', true)
      if (filteredReasons.length > 0) {
        let ry = y + 20
        filteredReasons.forEach(r => {
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.text)
          const lines = doc.splitTextToSize(`• ${r}`, W - 28 - 60 - 6)
          lines.forEach((l: string) => { doc.text(l, 60, ry); ry += 4.5 })
        })
      }
      y += cardH + 6

      // ─── INFORMATIONS EMAIL ──────────────────────────────────
      y = sectionTitle('Informations de l\'email', y)
      const { email } = data
      const infoRows = [
        ['Expéditeur', email.sender ?? '—'],
        ['Objet', email.subject ?? '(sans objet)'],
        ['Destinataires', email.recipients.join(', ') || '—'],
        ['Date', email.date ?? '—'],
      ]
      infoRows.forEach(([label, value]) => {
        text(label, 14, y, 8.5, COLORS.muted)
        const wrapped = doc.splitTextToSize(value, 130)
        text(wrapped[0], 55, y, 8.5, COLORS.text)
        y += 6
      })
      y += 4

      // ─── AUTHENTIFICATION ────────────────────────────────────
      y = sectionTitle('Authentification', y)
      const { header_analysis: h } = data
      const auths = [
        { label: 'SPF',   ...h.spf },
        { label: 'DKIM',  ...h.dkim },
        { label: 'DMARC', ...h.dmarc },
      ]
      auths.forEach((a, i) => {
        const cx = 28 + i * 55
        fillRect(cx - 14, y, 48, 18, COLORS.card)
        doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.2)
        doc.rect(cx - 14, y, 48, 18)
        text(a.label, cx, y + 7, 9, COLORS.muted, 'center', true)
        const aLabel = authLabel(a.present, a.pass_)
        const aColor = authColor(a.present, a.pass_)
        text(aLabel, cx, y + 14, 9, aColor, 'center', true)
      })
      y += 26

      // Reply-To suspect
      if (h.reply_to?.differs_from_sender) {
        fillRect(14, y, W - 28, 9, [255, 230, 230])
        text(`⚠ Reply-To différent de l'expéditeur : ${h.reply_to.address ?? '?'}`, 17, y + 6, 8, COLORS.dangerous)
        y += 13
      }

      // ─── FLAGS SUSPECTS (hors SPF/DKIM/DMARC déjà affichés) ──
      const suspiciousFlags = h.suspicious_flags.filter(f => !/spf|dkim|dmarc/i.test(f))
      if (suspiciousFlags.length > 0) {
        y = sectionTitle('Flags suspects détectés', y)
        suspiciousFlags.forEach(f => {
          doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.dangerous)
          const lines = doc.splitTextToSize(`• ${f}`, W - 28 - 6)
          lines.forEach((l: string) => { doc.text(l, 17, y); y += 5 })
        })
        y += 4
      }

      // ─── PIÈCES JOINTES ──────────────────────────────────────
      if (data.attachment_analyses.length > 0) {
        y = sectionTitle('Pièces jointes', y)
        data.attachment_analyses.forEach(a => {
          const rColor = COLORS[a.risk]
          // Ligne 1 : nom + badge risque
          const indicators = [
            a.mime_mismatch ? 'MISMATCH TYPE' : null,
            a.double_extension ? 'DOUBLE EXTENSION' : null,
            a.has_macros ? 'MACROS' : null,
            a.has_js_in_pdf ? 'JS/PDF' : null,
          ].filter(Boolean) as string[]

          const rowH = 8 + (a.mime_mismatch ? 5 : 0) + (indicators.length > 0 ? 5 : 0)
          fillRect(14, y - 3, W - 28, rowH + 2, COLORS.card)
          doc.setDrawColor(...COLORS.border); doc.setLineWidth(0.2)
          doc.rect(14, y - 3, W - 28, rowH + 2)

          // nom fichier (tronqué si trop long)
          doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.text)
          const maxNameW = W - 28 - 45
          const nameLines = doc.splitTextToSize(a.filename, maxNameW)
          doc.text(nameLines[0], 17, y + 2)

          badge(LEVEL_LABEL[a.risk], W - 46, y + 2, rColor)

          // MIME info
          if (a.mime_mismatch) {
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...COLORS.dangerous)
            const mimeStr = `Déclaré: ${a.declared_mime}  →  Réel: ${a.real_mime}`
            const mimeLines = doc.splitTextToSize(mimeStr, W - 28 - 6)
            mimeLines.forEach((l: string, li: number) => { doc.text(l, 17, y + 7 + li * 4) })
          }

          // Indicateurs supplémentaires
          if (indicators.length > 0) {
            const iy = y + (a.mime_mismatch ? 12 : 7)
            indicators.forEach((ind, ii) => {
              doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...COLORS.dangerous)
              doc.text(`⚠ ${ind}`, 17 + ii * 38, iy)
            })
          }

          y += rowH + 6
        })
        y += 2
      }

      // ─── HOPS RÉSEAU ────────────────────────────────────────
      if (h.received_hops.length > 0) {
        if (y > 240) { doc.addPage(); y = 16 }
        y = sectionTitle('Chemin réseau (Received hops)', y)
        h.received_hops.slice(0, 5).forEach((hop, i) => {
          text(`${i + 1}.`, 14, y, 8, COLORS.muted)
          if (hop.from_) text(`De : ${hop.from_}`, 20, y, 7.5, COLORS.text)
          if (hop.by)    text(`Par : ${hop.by}`, 20, y + 4.5, 7.5, COLORS.muted)
          y += hop.by ? 9 : 6
        })
        y += 2
      }

      // ─── FOOTER ─────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        fillRect(0, 290, W, 7, COLORS.border)
        text('Généré par MailScope', W / 2, 295, 7, COLORS.muted, 'center')
        text(`Page ${p} / ${pageCount}`, W - 14, 295, 7, COLORS.muted, 'right')
      }

      doc.save(filename)
    } finally {
      setExporting(false)
    }
  }, [filename])

  return { exportPdf, exporting }
}
