import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Avatar, Badge, Button, Card, EmptyState } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import ClientModal from '@/components/modals/ClientModal'
import CarModal from '@/components/modals/CarModal'
import { carName, clientName, jobTotal, useStore } from '@/data/store'
import { serviceDef } from '@/data/serviceCatalog'
import { fmtDate, initials } from '@/lib/utils'
import { IconChevronRight, IconPlus, IconTrash } from '@/components/Icons'
import { useMoney } from '@/components/Money'

export default function ClientDetailPage() {
  const { fmt } = useMoney()
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { clients, cars, jobs, removeClient } = useStore()
  const [edit, setEdit] = useState(false)
  const [carModal, setCarModal] = useState(false)

  const client = clients.find((c) => c.id === id)
  if (!client)
    return (
      <Card>
        <p className="text-sm text-fg-mute">Clientul nu există.</p>
      </Card>
    )

  const myCars = cars.filter((c) => c.clientId === client.id)
  const myJobs = jobs
    .filter((j) => j.clientId === client.id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
  const spent = myJobs.reduce((s, j) => s + jobTotal(j), 0)

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Clienți', to: '/clienti' }, { label: clientName(client) }]}
        title={clientName(client)}
        subtitle={`${client.type === 'pj' ? 'Firmă' : 'Persoană fizică'} · ${myCars.length} mașini · ${myJobs.length} programări · ${fmt(spent)} istoric`}
        action={
          <>
            <Button onClick={() => setEdit(true)}>Editează</Button>
            <Button variant="primary" onClick={() => nav('/programari/nou')}>
              <IconPlus width={15} height={15} /> Programare
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar text={initials(clientName(client))} />
              <div>
                <div className="font-bold">{clientName(client)}</div>
                <div className="text-[12px] text-fg-mute">client Custom Tuning</div>
              </div>
            </div>
            <dl className="mt-5 flex flex-col gap-3 text-[13px]">
              {[
                ['Telefon', client.phone],
                ['Email', client.email],
                [client.type === 'pj' ? 'CUI' : 'CNP', client.type === 'pj' ? client.vatId : client.cnp],
                ['Adresă', client.address],
                client.type === 'pj' ? ['Firmă', client.companyName] : null,
                ['Client din', fmtDate(client.createdAt)],
              ]
                .filter(Boolean)
                .map((row) => {
                  const [k, v] = row as [string, string]
                  return (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-fg-mute">{k}</dt>
                      <dd className="max-w-[60%] truncate text-right font-semibold">{v || '—'}</dd>
                    </div>
                  )
                })}
            </dl>
            {client.notes && (
              <>
                <div className="my-4 h-px bg-line" />
                <div className="mono-label mb-1.5">Mențiuni</div>
                <p className="text-[13px] text-fg-dim">{client.notes}</p>
              </>
            )}
          </Card>

          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Ștergi clientul, mașinile și programările lui?')) {
                removeClient(client.id)
                nav('/clienti')
              }
            }}
          >
            <IconTrash width={15} height={15} /> Șterge client
          </Button>
        </div>

        <div className="flex flex-col gap-5">
          <Card
            title="Mașini"
            pad={false}
            action={
              <button
                onClick={() => setCarModal(true)}
                className="text-[13px] font-semibold text-brand-400"
              >
                + Adaugă
              </button>
            }
          >
            {myCars.length === 0 ? (
              <EmptyState text="Nicio mașină adăugată încă." />
            ) : (
              <ul className="divide-y divide-line">
                {myCars.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/masini/${c.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.035]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{carName(c)}</div>
                        <div className="font-mono text-[11.5px] text-fg-faint">
                          {c.year || '—'} · {c.engine || '—'} · {c.plate}
                        </div>
                      </div>
                      <IconChevronRight width={16} height={16} className="text-fg-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Istoric programări" pad={false}>
            {myJobs.length === 0 ? (
              <EmptyState text="Fără programări." />
            ) : (
              <ul className="divide-y divide-line">
                {myJobs.map((j) => (
                  <li key={j.id}>
                    <Link
                      to={`/programari/${j.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-black/[0.035]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">
                          {j.services.map((s) => serviceDef(s.kind).label).join(' + ')}
                        </div>
                        <div className="font-mono text-[11.5px] text-fg-faint">
                          {j.code} · {fmtDate(j.startAt)} · {carName(cars.find((c) => c.id === j.carId))}
                        </div>
                      </div>
                      <Badge tone="neutral">{fmt(jobTotal(j))}</Badge>
                      <StatusBadge status={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ClientModal open={edit} onClose={() => setEdit(false)} editing={client} />
      <CarModal open={carModal} onClose={() => setCarModal(false)} defaultClientId={client.id} />
    </>
  )
}
