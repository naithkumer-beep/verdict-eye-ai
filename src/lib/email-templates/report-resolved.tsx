import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  reportTitle?: string
  reportId?: string
  pointsEarned?: number
  totalPoints?: number
  resolvedBy?: string
  appName?: string
  appUrl?: string
}

const ReportResolvedEmail = ({
  recipientName,
  reportTitle = 'Your report',
  reportId,
  pointsEarned = 50,
  totalPoints,
  resolvedBy,
  appName = 'CivicLens AI',
  appUrl = 'https://verdict-eye-ai.lovable.app',
}: Props) => {
  const link = reportId ? `${appUrl}/reports/${reportId}` : appUrl
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your report "${reportTitle}" has been resolved · +${pointsEarned} points`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your report has been resolved ✅</Heading>
          <Text style={text}>{recipientName ? `Hi ${recipientName},` : 'Hi there,'}</Text>
          <Text style={text}>
            Great news — your report <strong style={{ color: '#0F172A' }}>"{reportTitle}"</strong>{' '}
            has been marked <strong>resolved</strong> on {appName}. Thank you for helping improve your city.
          </Text>

          <Section style={box}>
            <Text style={boxTitle}>🏆 Reward earned</Text>
            <Text style={boxBig}>+{pointsEarned} points</Text>
            {typeof totalPoints === 'number' && (
              <Text style={boxSub}>Your total: {totalPoints} points</Text>
            )}
          </Section>

          <Text style={text}>
            <Link href={link} style={btn}>View your report</Link>
          </Text>

          {resolvedBy && <Text style={small}>Resolved by: {resolvedBy}</Text>}
          <Text style={small}>
            Keep reporting — every verified report earns you points and makes your community safer.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReportResolvedEmail,
  subject: (data: Record<string, any>) =>
    `✅ Resolved: ${data.reportTitle ?? 'your report'} · +${data.pointsEarned ?? 50} points`,
  displayName: 'Report resolved notification',
  previewData: {
    recipientName: 'Aung',
    reportTitle: 'Large pothole on Pyay Road',
    reportId: '00000000-0000-0000-0000-000000000000',
    pointsEarned: 50,
    totalPoints: 120,
    resolvedBy: 'admin@civiclens.ai',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 600, color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#334155' }
const small = { fontSize: '13px', lineHeight: '20px', color: '#64748B', marginTop: '24px' }
const box = { backgroundColor: '#F1F5F9', borderRadius: '12px', padding: '20px', margin: '20px 0', textAlign: 'center' as const }
const boxTitle = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#64748B', margin: '0 0 4px' }
const boxBig = { fontSize: '28px', fontWeight: 700, color: '#0F172A', margin: '0' }
const boxSub = { fontSize: '13px', color: '#475569', margin: '6px 0 0' }
const btn = { display: 'inline-block', padding: '10px 18px', backgroundColor: '#0F172A', color: '#ffffff', textDecoration: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }
