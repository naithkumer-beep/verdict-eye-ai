import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  newRole?: string
  grantedBy?: string
  appName?: string
}

const RoleChangedEmail = ({
  recipientName,
  newRole = 'user',
  grantedBy,
  appName = 'CivicLens AI',
}: Props) => {
  const isPrivileged = newRole === 'admin' || newRole === 'moderator'
  const title = isPrivileged
    ? `You're now a ${newRole} on ${appName}`
    : `Your role on ${appName} has been updated`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>
            {recipientName ? `Hi ${recipientName},` : 'Hi there,'}
          </Text>
          <Text style={text}>
            An administrator has updated your account role on {appName}.
            Your new role is{' '}
            <strong style={{ color: '#0F172A' }}>{newRole.toUpperCase()}</strong>.
          </Text>
          {isPrivileged && (
            <Section style={box}>
              <Text style={boxText}>
                You now have access to the admin tools, including the
                operations queue, command center, audit logs, and user
                management.
              </Text>
            </Section>
          )}
          {grantedBy && (
            <Text style={small}>Action performed by: {grantedBy}</Text>
          )}
          <Text style={small}>
            If you believe this change was made in error, please contact
            the {appName} team immediately.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RoleChangedEmail,
  subject: (data: Record<string, any>) =>
    data.newRole === 'admin' || data.newRole === 'moderator'
      ? `You're now a ${data.newRole} on CivicLens AI`
      : 'Your CivicLens AI role has been updated',
  displayName: 'Role changed notification',
  previewData: {
    recipientName: 'Aung',
    newRole: 'admin',
    grantedBy: 'admin@civiclens.ai',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#334155' }
const small = { fontSize: '13px', lineHeight: '20px', color: '#64748B', marginTop: '24px' }
const box = {
  backgroundColor: '#F1F5F9',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
}
const boxText = { fontSize: '14px', lineHeight: '22px', color: '#0F172A', margin: 0 }
