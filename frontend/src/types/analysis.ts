export interface Attachment {
  filename: string
  content_type: string
  size: number
}

export interface ParsedEmail {
  subject: string | null
  sender: string | null
  recipients: string[]
  date: string | null
  body_text: string | null
  body_html: string | null
  attachments: Attachment[]
  headers: Record<string, string>
}

export interface AuthResult {
  present: boolean
  pass_: boolean | null
  raw: string | null
}

export interface ReceivedHop {
  raw: string
  from_: string | null
  by: string | null
  timestamp: string | null
}

export interface ReplyToAnalysis {
  address: string | null
  differs_from_sender: boolean
}

export interface HeaderAnalysis {
  spf: AuthResult
  dkim: AuthResult
  dmarc: AuthResult
  message_id: string | null
  return_path: string | null
  reply_to: ReplyToAnalysis | null
  received_hops: ReceivedHop[]
  x_originating_ip: string | null
  suspicious_flags: string[]
}

export interface AttachmentAnalysis {
  filename: string
  declared_mime: string
  real_mime: string
  extension: string
  size: number
  mime_mismatch: boolean
  has_macros: boolean
  macro_details: string[]
  has_js_in_pdf: boolean
  double_extension: boolean
  risk: 'safe' | 'suspicious' | 'dangerous'
  risk_reasons: string[]
}

export interface ScoreResult {
  score: number
  level: 'safe' | 'suspicious' | 'dangerous'
  reasons: string[]
}

export interface AnalyzeResponse {
  email: ParsedEmail
  header_analysis: HeaderAnalysis
  attachment_analyses: AttachmentAnalysis[]
  score: ScoreResult
}
