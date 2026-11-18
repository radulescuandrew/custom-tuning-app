import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button, Card, EmptyState, TableWrap, Td, Th } from '@/components/ui'
import CarModal from '@/components/modals/CarModal'
import { carName, clientName, useStore } from '@/data/store'
import { IconChevronRight, IconPlus, IconSearch } from '@/components/Icons'

export default function CarsPage() {
  const nav = useNavigate()
  const { cars, clients, jobs } = useStore()
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return cars.filter((c) =>
      !s
        ? true
        : [carName(c), c.plate, c.vin, c.chassis, clientName(clients.find((x) => x.id === c.clientId))]
            .join(' ')
            .toLowerCase()
            .includes(s),
    )
  }, [cars, clients, q])

  return (
    <>
      <PageHeader
        title="Mașini"
        subtitle={`${cars.length} mașini în bază`}
        action={
          <Button variant="primary" onClick={() => setModal(true)}>
            <IconPlus width={16} height={16} /> Adaugă mașină
          </Button>
        }
      />

      <div className="relative mb-4 w-full max-w-xl">
        <IconSearch
          width={15}
          height={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută marcă, model, nr. înmatriculare, VIN, proprietar…"
          className="w-full rounded-lg border border-line-strong bg-ink-750 py-2 pr-3 pl-9 text-[14px] outline-none focus:border-brand-500/60"
        />
      </div>

      <Card pad={false}>
        {list.length === 0 ? (
          <EmptyState text="Nicio mașină găsită." />
        ) : (
          <TableWrap>
            <thead className="border-b border-line">
              <tr>
                <Th>Mașină</Th>
                <Th>Proprietar</Th>
                <Th>An</Th>
                <Th>Nr.</Th>
                <Th>Lucrări</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => nav(`/masini/${c.id}`)}
                  className="cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-black/[0.035]"
                >
                  <Td>
                    <div className="font-semibold">{carName(c)}</div>
                    <div className="font-mono text-[11px] text-fg-faint">{c.engine || '—'}</div>
                  </Td>
                  <Td className="text-fg-mute">
                    {clientName(clients.find((x) => x.id === c.clientId))}
                  </Td>
                  <Td className="font-mono text-fg-mute">{c.year ?? '—'}</Td>
                  <Td className="font-mono">{c.plate}</Td>
                  <Td className="text-fg-mute">{jobs.filter((j) => j.carId === c.id).length}</Td>
                  <Td className="text-fg-faint">
                    <IconChevronRight width={16} height={16} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <CarModal open={modal} onClose={() => setModal(false)} onSaved={(c) => nav(`/masini/${c.id}`)} />
    </>
  )
}
