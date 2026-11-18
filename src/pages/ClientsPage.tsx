import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, Chip, EmptyState, TableWrap, Td, Th } from '@/components/ui'
import ClientModal from '@/components/modals/ClientModal'
import { activeClients, clientName, useStore } from '@/data/store'
import { IconChevronRight, IconPlus } from '@/components/Icons'

export default function ClientsPage() {
  const nav = useNavigate()
  const { clients, cars, jobs } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'toti' | 'pf' | 'pj' | 'arhivati'>('toti')
  const active = activeClients(clients)
  const archived = clients.filter((c) => c.archivedAt)
  const [modal, setModal] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (type === 'arhivati' ? archived : active)
      .filter((c) => (type === 'toti' || type === 'arhivati' ? true : c.type === type))
      .filter((c) =>
        !s
          ? true
          : [clientName(c), c.phone, c.email, c.cnp, c.vatId].join(' ').toLowerCase().includes(s),
      )
  }, [active, archived, q, type])

  return (
    <>
      <PageHeader
        title="Clienți"
        subtitle={`${active.length} clienți · ${cars.length} mașini`}
        action={
          <Button variant="primary" onClick={() => setModal(true)}>
            <IconPlus width={16} height={16} /> Client nou
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['toti', 'pf', 'pj'] as const).map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {t === 'toti' ? 'Toți' : t === 'pf' ? 'Persoane fizice' : 'Firme'}
          </Chip>
        ))}
        {archived.length > 0 && (
          <Chip active={type === 'arhivati'} onClick={() => setType('arhivati')}>
            Arhivați <span className="ml-1 font-mono text-[11px] opacity-70">{archived.length}</span>
          </Chip>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută nume, telefon, CUI…"
          className="ml-auto w-64 rounded-lg border border-line-strong bg-ink-750 px-3 py-1.5 text-[13px] outline-none focus:border-brand-500/60"
        />
      </div>

      <Card pad={false}>
        {list.length === 0 ? (
          <EmptyState text="Niciun client găsit." />
        ) : (
          <TableWrap>
            <thead className="border-b border-line">
              <tr>
                <Th>Nume</Th>
                <Th>Telefon</Th>
                <Th>Mașini</Th>
                <Th>Programări</Th>
                <Th>Formă</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => nav(`/clienti/${c.id}`)}
                  className="cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-black/[0.035]"
                >
                  <Td className="font-semibold">{clientName(c)}</Td>
                  <Td className="font-mono text-[12.5px] text-fg-mute">{c.phone || '—'}</Td>
                  <Td className="text-fg-mute">{cars.filter((x) => x.clientId === c.id).length}</Td>
                  <Td className="text-fg-mute">{jobs.filter((x) => x.clientId === c.id).length}</Td>
                  <Td>
                    <Badge tone={c.type === 'pj' ? 'gold' : 'neutral'}>
                      {c.type === 'pj' ? 'firmă' : 'pf'}
                    </Badge>
                  </Td>
                  <Td className="text-fg-faint">
                    <IconChevronRight width={16} height={16} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <ClientModal open={modal} onClose={() => setModal(false)} onSaved={(c) => nav(`/clienti/${c.id}`)} />
    </>
  )
}
