import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { StatusBadge } from '@/components/StatusBadge'
import CarModal from '@/components/modals/CarModal'
import { carName, clientName, jobTotal, useStore } from '@/data/store'
import { serviceLabel, carClassLabel, effectiveCarClass } from '@/data/serviceCatalog'
import { fmtDate } from '@/lib/utils'
import { IconPlus, IconTrash } from '@/components/Icons'
import { useMoney } from '@/components/Money'

export default function CarDetailPage() {
  const { fmt } = useMoney()
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { cars, clients, jobs, stock, removeCar } = useStore()
  const [edit, setEdit] = useState(false)

  const car = cars.find((c) => c.id === id)
  if (!car)
    return (
      <Card>
        <p className="text-sm text-fg-mute">Mașina nu există.</p>
      </Card>
    )

  const owner = clients.find((c) => c.id === car.clientId)
  const myJobs = jobs
    .filter((j) => j.carId === car.id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))

  /** Istoricul foliilor aplicate pe mașină — util la retuș/garanție. */
  const filmHistory = myJobs.flatMap((j) =>
    j.services
      .filter((s) => s.kind === 'colantare')
      .map((s) => {
        /* datele foliei vin din rola aleasă; valorile scrise de mână rămân la lucrările vechi */
        const roll = stock.find((x) => x.id === (s.values.ppfRoll || s.values.colorRoll))
        return {
          job: j,
          maker: roll?.maker || s.values.ppfMaker || s.values.colorMaker || '—',
          detail: roll
            ? [
                roll.name,
                roll.finish === 'lucioasa' ? 'lucioasă' : roll.finish === 'mata' ? 'mată' : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : s.values.colorName || s.values.ppfFinish || '',
          meters: s.values.metersUsed,
          elements: s.elements.filter((e) => e.checked).length,
        }
      }),
  )

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Mașini', to: '/masini' },
          { label: clientName(owner), to: `/clienti/${owner?.id}` },
          { label: carName(car) },
        ]}
        title={carName(car)}
        subtitle={`${car.year ?? '—'} · ${car.engine || '—'} · ${car.plate}`}
        action={
          <>
            <Button onClick={() => setEdit(true)}>Editează</Button>
            <Button variant="primary" onClick={() => nav('/programari/nou')}>
              <IconPlus width={15} height={15} /> Programare
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_330px]">
        <div className="flex flex-col gap-5">
          <Card title="Istoric la Custom Tuning" pad={false}>
            {myJobs.length === 0 ? (
              <EmptyState text="Fără lucrări înregistrate." />
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
                          {j.services.map((s) => serviceLabel(s)).join(' + ')}
                        </div>
                        <div className="font-mono text-[11.5px] text-fg-faint">
                          {j.code} · {fmtDate(j.startAt)} · {j.assignee}
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

          <Card title="Folii aplicate" pad={false}>
            {filmHistory.length === 0 ? (
              <EmptyState text="Nicio colantare înregistrată." />
            ) : (
              <ul className="divide-y divide-line">
                {filmHistory.map((f, i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">
                        {f.maker} {f.detail && `· ${f.detail}`}
                      </div>
                      <div className="font-mono text-[11px] text-fg-faint">
                        {f.job.code} · {fmtDate(f.job.startAt)} · {f.elements} elemente
                      </div>
                    </div>
                    <span className="font-mono text-[13px] text-fg-mute">{f.meters || '—'} m</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Date tehnice">
            <dl className="flex flex-col gap-3 text-[13px]">
              {[
                ['Marcă', car.make],
                ['Model', car.model],
                ['An fabricație', car.year ? String(car.year) : '—'],
                ['Clasă prețuri', carClassLabel(effectiveCarClass(car))],
                ['Motorizare', car.engine],
                ['Culoare', car.color],
                ['Nr. înmatriculare', car.plate],
                ['VIN', car.vin],
                ['Serie șasiu', car.chassis],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fg-mute">{k}</dt>
                  <dd className="max-w-[60%] truncate text-right font-semibold">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Proprietar">
            <div className="font-semibold">{clientName(owner)}</div>
            <div className="mt-1 font-mono text-[12px] text-fg-mute">{owner?.phone}</div>
            <Button size="sm" className="mt-3" onClick={() => nav(`/clienti/${owner?.id}`)}>
              Deschide fișa clientului
            </Button>
          </Card>

          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Ștergi mașina și programările ei?')) {
                removeCar(car.id)
                nav('/masini')
              }
            }}
          >
            <IconTrash width={15} height={15} /> Șterge mașina
          </Button>
        </div>
      </div>

      <CarModal open={edit} onClose={() => setEdit(false)} editing={car} />
    </>
  )
}
