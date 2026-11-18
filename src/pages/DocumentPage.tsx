import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { carName, jobTotal, useStore } from '@/data/store'
import { serviceDef, serviceLabel } from '@/data/serviceCatalog'
import type { Car, Client, Job, Settings, StockItem } from '@/data/types'
import { Button } from '@/components/ui'
import { Logo } from '@/components/Logo'
import { IconPrint } from '@/components/Icons'
import { amounts, fmtRon, vatNote } from '@/lib/money'
import { addBusinessDays, cx, fmtDate, fmtDateTime } from '@/lib/utils'
import { photoUrl } from '@/lib/photos'
import {
  DOCS,
  careAdvice,
  checkedElements,
  docDate,
  docMeta,
  docNumber,
  rollUsageLines,
  serviceDetails,
  type DocKind,
} from '@/lib/documents'

/**
 * Contract + procese-verbale generate din datele programării, ca pagină A4 printabilă
 * (Printează → Salvează ca PDF). Machetă generică — se înlocuiește cu formatul Custom Tuning.
 */
export default function DocumentPage() {
  const { id = '', doc = '' } = useParams()
  const nav = useNavigate()
  const { jobs, clients, cars, stock, settings } = useStore()
  const job = jobs.find((j) => j.id === id)
  const meta = docMeta(doc)

  if (!job || !meta)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <p className="text-fg-mute">Documentul nu există.</p>
          <Link to="/programari" className="mt-3 inline-block text-sm text-brand-400">
            Înapoi la programări
          </Link>
        </div>
      </div>
    )

  const client = clients.find((c) => c.id === job.clientId)
  const car = cars.find((c) => c.id === job.carId)
  const kind = meta.kind
  const ctx: Ctx = { job, client, car, stock, settings }

  return (
    <div className="min-h-dvh bg-[#e7e7ea] py-5 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 px-4 print:hidden">
        <Button onClick={() => nav(`/programari/${job.id}`)}>← {job.code}</Button>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {DOCS.map((d) => (
            <Link
              key={d.kind}
              to={`/documente/${job.id}/${d.kind}`}
              replace
              className={cx(
                'rounded-lg border px-3 py-2 text-[13px] font-semibold transition',
                d.kind === kind
                  ? 'border-brand-500/50 bg-brand-500/12 text-brand-500'
                  : 'border-line bg-white text-fg-mute hover:text-fg',
              )}
            >
              {d.short}
            </Link>
          ))}
        </div>
        <Button variant="primary" onClick={() => window.print()}>
          <IconPrint width={15} height={15} /> Printează / PDF
        </Button>
      </div>

      <article className="doc-paper mx-auto w-full max-w-[210mm] bg-white px-5 py-8 text-[12.5px] leading-[1.55] text-[#1b1b1b] shadow-[0_2px_18px_rgba(0,0,0,0.12)] sm:px-[16mm] sm:py-[14mm]">
        <DocHeader kind={kind} job={job} settings={settings} />
        {kind === 'contract' && <Contract {...ctx} />}
        {kind === 'pv-primire' && <PvPrimire {...ctx} />}
        {kind === 'pv-predare' && <PvPredare {...ctx} />}
      </article>
    </div>
  )
}

type Ctx = {
  job: Job
  client?: Client
  car?: Car
  stock: StockItem[]
  settings: Settings
}

/* ───────────────────────── piese comune ───────────────────────── */

const d = (iso: string | null | undefined) => (iso ? fmtDate(iso, 'dd.MM.yyyy') : '')

/** Persoana care semnează: „Prenume Nume” (la PJ, reprezentantul). */
const person = (c?: Client) => (c ? `${c.firstName} ${c.lastName}`.trim() : '')

/** Câmp de completat de mână: arată valoarea dacă există, altfel o linie punctată. */
function Blank({ value, w = 'min-w-[38mm]' }: { value?: string | number | null; w?: string }) {
  if (value !== undefined && value !== null && String(value).trim() !== '')
    return <strong className="font-semibold">{value}</strong>
  return <span className={cx('inline-block border-b border-dotted border-[#888] align-bottom', w)}>&nbsp;</span>
}

function Box({ label }: { label: string }) {
  return (
    <span className="mr-4 inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="inline-block h-3 w-3 border border-[#555]" />
      {label}
    </span>
  )
}

function Sec({ n, title, children }: { n?: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-[#111]">
        {n !== undefined && `${n}. `}
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  )
}

function DocHeader({ kind, job, settings }: { kind: DocKind; job: Job; settings: Settings }) {
  const meta = docMeta(kind)!
  return (
    <header>
      <div className="flex items-start justify-between gap-6 border-b-2 border-[#111] pb-4">
        <Logo size="md" />
        <div className="text-right text-[11px] leading-snug text-[#444]">
          <div className="font-bold text-[#111]">{settings.companyName}</div>
          <div>CUI {settings.vatId}</div>
          <div>
            Reg. Com. <Blank w="min-w-[24mm]" />
          </div>
          <div>customtuning.ro</div>
        </div>
      </div>
      <div className="mt-6 text-center">
        <h1 className="text-[17px] font-bold uppercase tracking-wide">{meta.label}</h1>
        <div className="mt-1 text-[12px] text-[#444]">
          nr. <strong>{docNumber(kind, job)}</strong> din <strong>{d(docDate(kind, job))}</strong> ·
          programare {job.code}
        </div>
      </div>
    </header>
  )
}

function ClientLine({ client }: { client?: Client }) {
  if (!client) return <p>—</p>
  const contact = (
    <>
      telefon <Blank value={client.phone} />, e-mail <Blank value={client.email} />
    </>
  )
  if (client.type === 'pj')
    return (
      <p>
        <strong>{client.companyName}</strong>, cu sediul în <Blank value={client.address} w="min-w-[60mm]" />,
        CUI <Blank value={client.vatId} />, reprezentată prin{' '}
        <strong>
          {client.firstName} {client.lastName}
        </strong>
        , {contact}, denumită în continuare <strong>Beneficiar</strong>.
      </p>
    )
  return (
    <p>
      <strong>
        {client.firstName} {client.lastName}
      </strong>
      , CNP <Blank value={client.cnp} />, cu domiciliul în{' '}
      <Blank value={client.address} w="min-w-[60mm]" />, {contact}, denumit în continuare{' '}
      <strong>Beneficiar</strong>.
    </p>
  )
}

function CompanyLine({ settings, role }: { settings: Settings; role: string }) {
  return (
    <p>
      <strong>{settings.companyName}</strong>, cu sediul în <Blank w="min-w-[55mm]" />, CUI{' '}
      {settings.vatId}, reprezentată prin <Blank />, denumită în continuare <strong>{role}</strong>.
    </p>
  )
}

function CarTable({ car }: { car?: Car }) {
  const rows: [string, string | number | null | undefined][] = [
    ['Marcă / model', car ? carName(car) : ''],
    ['An fabricație', car?.year],
    ['Motorizare', car?.engine],
    ['Nr. înmatriculare', car?.plate],
    ['VIN', car?.vin],
    ['Serie șasiu', car?.chassis],
    ['Culoare', car?.color],
  ]
  return (
    <table className="w-full border-collapse text-[12px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="w-[38%] border border-[#ccc] bg-[#f6f6f6] px-2.5 py-1 text-[#444]">{k}</td>
            <td className="border border-[#ccc] px-2.5 py-1 font-mono font-medium">{v || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ServicesTable({ job, settings }: { job: Job; settings: Settings }) {
  const a = amounts(jobTotal(job), settings)
  const cell = 'border border-[#ccc] px-2.5 py-1'
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="bg-[#f6f6f6] text-left text-[#444]">
          <th className={cx(cell, 'w-8 font-semibold')}>#</th>
          <th className={cx(cell, 'font-semibold')}>Serviciu</th>
          <th className={cx(cell, 'font-semibold')}>Elemente / detalii</th>
          <th className={cx(cell, 'w-[30mm] text-right font-semibold')}>Preț</th>
        </tr>
      </thead>
      <tbody>
        {job.services.map((s, i) => {
          const els = checkedElements(s)
          return (
            <tr key={s.id} className="align-top">
              <td className={cell}>{i + 1}</td>
              <td className={cx(cell, 'font-semibold')}>{serviceLabel(s)}</td>
              <td className={cx(cell, 'text-[11.5px] text-[#444]')}>
                {els.length ? els.join(', ') : serviceDef(s.kind).short}
              </td>
              <td className={cx(cell, 'text-right font-mono')}>{fmtRon(s.price)}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        {a.showsVat && (
          <>
            <tr>
              <td colSpan={3} className={cx(cell, 'text-right text-[#444]')}>
                Subtotal (fără TVA)
              </td>
              <td className={cx(cell, 'text-right font-mono')}>{fmtRon(a.net)}</td>
            </tr>
            <tr>
              <td colSpan={3} className={cx(cell, 'text-right text-[#444]')}>
                TVA {settings.vatRate}%
              </td>
              <td className={cx(cell, 'text-right font-mono')}>{fmtRon(a.vat)}</td>
            </tr>
          </>
        )}
        <tr className="bg-[#f6f6f6]">
          <td colSpan={3} className={cx(cell, 'text-right font-bold')}>
            Total de plată
          </td>
          <td className={cx(cell, 'text-right font-mono font-bold')}>{fmtRon(a.gross)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function Signatures({ left, right }: { left: [string, string?]; right: [string, string?] }) {
  return (
    <div className="mt-10 grid break-inside-avoid grid-cols-2 gap-10 text-[12px]">
      {[left, right].map(([role, name]) => (
        <div key={role}>
          <div className="font-bold uppercase">{role}</div>
          <div className="mt-1 text-[#444]">
            Nume: <Blank value={name} />
          </div>
          <div className="mt-8 border-b border-[#555]" />
          <div className="mt-1 text-[11px] text-[#666]">Semnătura</div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────── contract ───────────────────────── */

function Contract({ job, client, car, settings }: Ctx) {
  const total = amounts(jobTotal(job), settings).gross
  return (
    <>
      <Sec n={1} title="Părțile contractante">
        <CompanyLine settings={settings} role="Prestator" />
        <p>și</p>
        <ClientLine client={client} />
      </Sec>

      <Sec n={2} title="Obiectul contractului">
        <p>
          Prestatorul se obligă să execute serviciile de mai jos asupra vehiculului descris, cu
          materialele și la prețurile convenite, iar Beneficiarul se obligă să achite contravaloarea
          acestora.
        </p>
        <CarTable car={car} />
        <div className="mt-2">
          <ServicesTable job={job} settings={settings} />
        </div>
      </Sec>

      <Sec n={3} title="Termene">
        <p>
          Primirea vehiculului: <strong>{fmtDateTime(job.startAt)}</strong>. Execuție estimată:{' '}
          <strong>
            {d(job.workStartAt) || '—'}
            {job.workEndAt && d(job.workEndAt) !== d(job.workStartAt) && ` – ${d(job.workEndAt)}`}
          </strong>
          . Predare estimată: <Blank value={d(job.deliveryAt)} />.
        </p>
        <p>
          Termenele se pot prelungi cu acordul Beneficiarului dacă apar lipsuri de materiale sau
          piese ori defecte ascunse descoperite în timpul lucrării; Beneficiarul va fi anunțat
          telefonic sau în scris.
        </p>
      </Sec>

      <Sec n={4} title="Prețul și modalitatea de plată">
        <p>
          Valoarea totală a serviciilor este de <strong>{fmtRon(total)}</strong> ({vatNote(settings)}).
          Plata se face integral la predarea vehiculului, numerar, cu cardul sau prin ordin de plată.
          Pentru piesele comandate special se poate solicita un avans de <Blank w="min-w-[12mm]" /> %.
        </p>
        <p>Lucrările suplimentare față de prezentul contract se execută numai cu acordul Beneficiarului.</p>
      </Sec>

      <Sec n={5} title="Obligațiile părților">
        <p>
          <strong>Prestatorul</strong> execută lucrările profesional, cu materialele specificate;
          păstrează vehiculul în siguranță pe durata lucrării; informează Beneficiarul despre orice
          defect constatat.
        </p>
        <p>
          <strong>Beneficiarul</strong> predă vehiculul curat, împreună cu actele acestuia; achită
          prețul la termen; ridică vehiculul în cel mult 3 zile lucrătoare de la anunțarea finalizării,
          după care se poate percepe o taxă de parcare de <Blank w="min-w-[14mm]" /> RON/zi.
        </p>
      </Sec>

      <Sec n={6} title="Garanție">
        <p>
          Manopera are garanție 12 luni. Foliile (PPF, colant, folii geamuri) și protecțiile ceramice
          au garanția oferită de producător. Garanția foliilor este condiționată de prezentarea la
          retuș în primele 7 zile lucrătoare de la predare.
        </p>
        <p>
          Garanția nu acoperă deteriorările mecanice, accidentele, spălarea necorespunzătoare sau
          intervențiile terților asupra lucrării.
        </p>
      </Sec>

      <Sec n={7} title="Dispoziții finale">
        <p>
          Starea vehiculului la primire se consemnează în procesul-verbal de primire nr.{' '}
          {docNumber('pv-primire', job)}, care face parte integrantă din prezentul contract. Litigiile
          se soluționează pe cale amiabilă, iar în caz contrar de instanțele competente. Contractul s-a
          încheiat în 2 exemplare, câte unul pentru fiecare parte.
        </p>
      </Sec>

      <Signatures
        left={['Prestator']}
        right={['Beneficiar', person(client)]}
      />
    </>
  )
}

/* ───────────────────────── PV primire ───────────────────────── */

function JobPhotos({ job }: { job: Job }) {
  const [urls, setUrls] = useState<{ id: string; url: string; caption: string }[]>([])
  useEffect(() => {
    let alive = true
    Promise.all(
      job.photos
        .filter((p) => !p.serviceId)
        .map(async (p) => ({ id: p.id, url: await photoUrl(p.key), caption: p.caption })),
    ).then((r) => alive && setUrls(r.filter((x) => x.url)))
    return () => {
      alive = false
    }
  }, [job.photos])
  if (urls.length === 0) return null
  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      {urls.map((p) => (
        <figure key={p.id} className="break-inside-avoid">
          <img src={p.url} alt={p.caption} className="aspect-[4/3] w-full rounded border border-[#ccc] object-cover" />
          {p.caption && <figcaption className="mt-0.5 text-[10px] text-[#555]">{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

function PvPrimire({ job, client, car, settings }: Ctx) {
  return (
    <>
      <Sec title="Părțile">
        <p>
          Încheiat astăzi, <strong>{fmtDateTime(docDate('pv-primire', job))}</strong>, la atelierul{' '}
          {settings.companyName}, între:
        </p>
        <ClientLine client={client} />
        <p>
          în calitate de <strong>predător</strong>, și <strong>{settings.companyName}</strong>, prin{' '}
          <strong>{job.assignee}</strong>, în calitate de <strong>primitor</strong>.
        </p>
      </Sec>

      <Sec title="Vehiculul predat">
        <CarTable car={car} />
      </Sec>

      <Sec title="Starea la primire">
        <p>
          Kilometraj la bord: <Blank w="min-w-[28mm]" /> km
        </p>
        <p>
          Nivel combustibil: <Box label="rezervă" />
          <Box label="1/4" />
          <Box label="1/2" />
          <Box label="3/4" />
          <Box label="plin" />
        </p>
        <p className="leading-loose">
          Predate odată cu vehiculul: <Box label="certificat înmatriculare" />
          <Box label="chei (nr. ___ )" />
          <Box label="roată rezervă / kit" />
          <Box label="trusă medicală" />
          <Box label="extinctor" />
          <Box label="triunghiuri" />
        </p>
        <p>
          Alte obiecte lăsate în vehicul: <Blank w="min-w-[90mm]" />
        </p>
      </Sec>

      {/* mențiunile sunt de la programare (înainte de venirea mașinii) — nu sunt defecte constatate */}
      {job.notes && (
        <Sec title="Mențiuni de la programare">
          <p className="whitespace-pre-line rounded border border-[#ccc] bg-[#fafafa] px-3 py-2">{job.notes}</p>
        </Sec>
      )}

      <Sec title="Defecte și observații constatate la primire">
        <div className="flex flex-col gap-4 pt-2">
          <div className="border-b border-dotted border-[#888]" />
          <div className="border-b border-dotted border-[#888]" />
          <div className="border-b border-dotted border-[#888]" />
        </div>
        {job.photos.some((p) => !p.serviceId) && (
          <p className="text-[11.5px] text-[#555]">
            {job.photos.filter((p) => !p.serviceId).length} fotografii atașate în fișa programării{' '}
            {job.code}.
          </p>
        )}
        <JobPhotos job={job} />
      </Sec>

      <Sec title="Lucrări solicitate">
        <p>{job.services.map((s) => serviceLabel(s)).join(', ')}.</p>
      </Sec>

      <Sec title="Declarații">
        <p>
          Beneficiarul declară că defectele de mai sus existau înainte de intrarea vehiculului în
          atelier și că a scos din vehicul bunurile de valoare. Prestatorul nu răspunde pentru
          bunurile nedeclarate în prezentul proces-verbal.
        </p>
      </Sec>

      <Signatures
        left={['Am predat (Beneficiar)', person(client)]}
        right={['Am primit (Prestator)', job.assignee]}
      />
    </>
  )
}

/* ───────────────────────── PV predare ───────────────────────── */

function PvPredare({ job, client, car, stock, settings }: Ctx) {
  const date = docDate('pv-predare', job)
  const needsRetouch = job.services.some((s) => serviceDef(s.kind).retouch)
  const total = amounts(jobTotal(job), settings).gross
  return (
    <>
      <Sec title="Părțile">
        <p>
          Încheiat astăzi, <strong>{d(date)}</strong>, între <strong>{settings.companyName}</strong>,
          prin <strong>{job.assignee}</strong>, în calitate de <strong>predător</strong>, și:
        </p>
        <ClientLine client={client} />
        <p>
          în calitate de <strong>primitor</strong>, privind vehiculul{' '}
          <strong>
            {carName(car)} · {car?.plate}
          </strong>{' '}
          (VIN <span className="font-mono">{car?.vin || '—'}</span>).
        </p>
      </Sec>

      <Sec title="Lucrări efectuate">
        {job.services.map((s, i) => {
          const details = serviceDetails(s, stock)
          const els = checkedElements(s)
          const rolls = rollUsageLines(s, stock)
          return (
            <div key={s.id} className="break-inside-avoid rounded border border-[#ccc] px-3 py-2">
              <div className="flex justify-between gap-3 font-semibold">
                <span>
                  {i + 1}. {serviceLabel(s)}
                </span>
                <span className="font-mono">{fmtRon(s.price)}</span>
              </div>
              {details.length > 0 && (
                <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-[11.5px] sm:grid-cols-2">
                  {details.map((r) => (
                    <div key={r.label} className="flex gap-1.5">
                      <dt className="whitespace-nowrap text-[#666]">{r.label}:</dt>
                      <dd className="font-medium">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {els.length > 0 && (
                <p className="mt-1 text-[11.5px]">
                  <span className="text-[#666]">Elemente: </span>
                  {els.join(', ')}
                </p>
              )}
              {rolls.length > 0 && (
                <p className="mt-1 text-[11.5px]">
                  <span className="text-[#666]">Material folosit: </span>
                  {rolls.join('; ')}
                </p>
              )}
            </div>
          )
        })}
        <p className="text-right">
          Total: <strong className="font-mono">{fmtRon(total)}</strong>{' '}
          <span className="text-[11px] text-[#666]">({vatNote(settings)})</span>
        </p>
      </Sec>

      <Sec title="Recomandări de întreținere">
        <ul className="list-disc pl-5">
          {careAdvice(job).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {needsRetouch && (
          <p className="mt-1 rounded border border-[#f0c8c8] border-l-4 border-l-[#d22] bg-[#fff6f6] px-3 py-2">
            Retuș gratuit până la <strong>{d(addBusinessDays(new Date(date), 7).toISOString())}</strong>.
            Vă vom trimite un mesaj de reamintire.
          </p>
        )}
      </Sec>

      <Sec title="Declarații">
        <p>
          Beneficiarul declară că a verificat vehiculul, că lucrările au fost executate conform
          comenzii și că nu are obiecții, cu excepția: <Blank w="min-w-[70mm]" />
        </p>
      </Sec>

      <Signatures
        left={['Am predat (Prestator)', job.assignee]}
        right={['Am primit (Beneficiar)', person(client)]}
      />
    </>
  )
}
