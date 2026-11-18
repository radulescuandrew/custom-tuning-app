import { useState } from 'react'
import { Link } from 'react-router-dom'
import { parseISO } from 'date-fns'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Chip, EmptyState } from '@/components/ui'
import { NOTIF_KIND_LABEL, carName, clientName, useStore } from '@/data/store'
import { daysUntil, fmtDate } from '@/lib/utils'
import { IconMail, IconPhone } from '@/components/Icons'

const KIND_LABEL = NOTIF_KIND_LABEL

const KIND_TONE: Record<string, 'gold' | 'sky' | 'mint'> = {
  retus_7z: 'gold',
  retus_reminder_3z: 'sky',
  detailing_6l: 'mint',
  ridicare: 'mint',
}

export default function NotificationsPage() {
  const { notifications, clients, jobs, cars, markNotificationSent, cancelNotification } = useStore()
  const [tab, setTab] = useState<'scadente' | 'programate' | 'trimise'>('scadente')

  const now = new Date()
  const filtered = notifications
    .filter((n) => {
      if (tab === 'trimise') return n.status === 'trimisa'
      if (tab === 'scadente') return n.status === 'programata' && parseISO(n.dueAt) <= now
      return n.status === 'programata' && parseISO(n.dueAt) > now
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))

  const counts = {
    scadente: notifications.filter((n) => n.status === 'programata' && parseISO(n.dueAt) <= now).length,
    programate: notifications.filter((n) => n.status === 'programata' && parseISO(n.dueAt) > now).length,
    trimise: notifications.filter((n) => n.status === 'trimisa').length,
  }

  return (
    <>
      <PageHeader
        title="Notificări clienți"
        subtitle="La „Finalizat” clientul e anunțat că poate ridica mașina. La „Predat”, pentru colantare și folii, pleacă a doua zi invitația la retuș, iar dacă retușul nu e marcat făcut, un reminder la 3 zile după cele 7 zile lucrătoare. Clienții de detailing primesc la 6 luni o invitație cu 10% reducere."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['scadente', 'programate', 'trimise'] as const).map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
            {t === 'scadente' ? 'De trimis acum' : t === 'programate' ? 'Programate' : 'Trimise'}{' '}
            <span className="ml-1 font-mono text-[11px] opacity-70">{counts[t]}</span>
          </Chip>
        ))}
      </div>

      <Card pad={false}>
        {filtered.length === 0 ? (
          <EmptyState text="Nimic aici." />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((n) => {
              const client = clients.find((c) => c.id === n.clientId)
              const job = jobs.find((j) => j.id === n.jobId)
              const car = cars.find((c) => c.id === job?.carId)
              const d = daysUntil(n.dueAt)
              const phone = (client?.phone ?? '').replace(/\D/g, '').replace(/^0/, '40')
              return (
                <li key={n.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-[240px] flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{clientName(client)}</span>
                      <Badge tone={KIND_TONE[n.kind] ?? 'gold'}>
                        {KIND_LABEL[n.kind]}
                      </Badge>
                    </div>
                    <div className="mt-1 font-mono text-[11.5px] text-fg-faint">
                      {job && (
                        <Link to={`/programari/${job.id}`} className="text-brand-400 hover:underline">
                          {job.code}
                        </Link>
                      )}{' '}
                      · {carName(car)} · scadent {fmtDate(n.dueAt)}{' '}
                      {n.status === 'programata' && (
                        <span className={d <= 0 ? 'text-ember' : ''}>
                          ({d <= 0 ? 'acum' : `în ${d} zile`})
                        </span>
                      )}
                    </div>
                    <p className="mt-2 max-w-2xl text-[12.5px] text-fg-mute">{n.message}</p>
                  </div>

                  {n.status === 'programata' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          window.open(
                            `https://wa.me/${phone}?text=${encodeURIComponent(n.message)}`,
                            '_blank',
                          )
                        }
                      >
                        <IconPhone width={14} height={14} /> WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          location.href = `mailto:${client?.email ?? ''}?subject=${encodeURIComponent(
                            'Custom Tuning · retuș folie',
                          )}&body=${encodeURIComponent(n.message)}`
                        }}
                      >
                        <IconMail width={14} height={14} /> Email
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => markNotificationSent(n.id)}>
                        Marchează trimis
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelNotification(n.id)}>
                        Anulează
                      </Button>
                    </div>
                  ) : (
                    <Badge tone="mint">trimis {fmtDate(n.sentAt)}</Badge>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-[12px] text-fg-faint">
        MVP: trimiterea se face manual din WhatsApp / email client. În producție se conectează un
        gateway SMS (ex. Twilio / SMSO) + WhatsApp Business API și trimiterea devine automată la
        scadență.
      </p>
    </>
  )
}
