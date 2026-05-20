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
