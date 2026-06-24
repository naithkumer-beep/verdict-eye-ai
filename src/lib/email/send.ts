// Client helper: POSTs to /lovable/email/transactional/send with the user's Supabase JWT.
import { supabase } from '@/integrations/supabase/client'

export interface SendTransactionalEmailArgs {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

export async function sendTransactionalEmail(args: SendTransactionalEmailArgs) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in')
  const res = await fetch('/lovable/email/transactional/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Email send failed (${res.status}): ${txt}`)
  }
  return res.json() as Promise<{ success: boolean; queued?: boolean; reason?: string }>
}
