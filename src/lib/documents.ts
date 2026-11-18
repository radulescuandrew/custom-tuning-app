import { serviceDef } from '@/data/serviceCatalog'
import type { Job, ServiceEntry, StockItem } from '@/data/types'
import { jobReceivedAt } from '@/data/store'

export type DocKind = 'contract' | 'pv-primire' | 'pv-predare'

export const DOCS: { kind: DocKind; label: string; short: string; hint: string }[] = [
  {
    kind: 'contract',
    label: 'Contract de prestări servicii',
    short: 'Contract',
    hint: 'Se semnează la primirea mașinii',
  },
  {
    kind: 'pv-primire',
    label: 'Proces-verbal de primire',
    short: 'PV primire',
    hint: 'Starea mașinii la intrarea în atelier',
  },
  {
    kind: 'pv-predare',
    label: 'Proces-verbal de predare',
    short: 'PV predare',
    hint: 'Lucrări efectuate, la ridicarea mașinii',
  },
]

export const docMeta = (kind: string) => DOCS.find((d) => d.kind === kind)

/** Număr de document derivat din codul programării: PRG-2041 → CTR-2041 / PVP-2041 / PVR-2041. */
export const docNumber = (kind: DocKind, job: Job) => {
  const n = job.code.replace(/^\D+-?/, '')
  return `${kind === 'contract' ? 'CTR' : kind === 'pv-primire' ? 'PVP' : 'PVR'}-${n}`
}

/** Data documentului: contract = crearea programării, PV primire = venirea mașinii, PV predare = finalizarea. */
export const docDate = (kind: DocKind, job: Job) =>
  kind === 'contract'
    ? job.createdAt
    : kind === 'pv-primire'
      ? (jobReceivedAt(job) ?? job.startAt)
      : (job.completedAt ?? job.deliveryAt ?? new Date().toISOString())

const EMPTY = new Set(['', '—', 'Nu'])

/** Detaliile completate ale unei fișe de serviciu, ca perechi etichetă/valoare (fără câmpurile goale). */
export const serviceDetails = (svc: ServiceEntry, stock: StockItem[]) => {
  const def = serviceDef(svc.kind)
  const rows: { label: string; value: string }[] = []
  for (const g of def.groups) {
    if (g.variantKey) {
      const variants = def.groups.filter((x) => x.variantKey === g.variantKey)
      const active = svc.values[g.variantKey] || variants[0].variantValue
      if (g.variantValue !== active) continue
    }
    for (const f of g.fields) {
      if (f.showIf && !f.showIf.equals.includes(svc.values[f.showIf.key] ?? '')) continue
      const raw = svc.values[f.key] ?? ''
      if (EMPTY.has(raw.trim())) continue
      // „Krytex 7H: Da” e redundant când rândul dependent („Krytex 7H · cod sticlă: …”) e completat
      const dependent = g.fields.find((x) => x.showIf?.key === f.key)
      if (dependent && (svc.values[dependent.key] ?? '').trim()) continue
      // rola cu consum înregistrat apare deja la „Material folosit”, cu metrii
      if (f.type === 'roll' && svc.rollUsages.some((u) => u.stockItemId === raw && u.qty > 0)) continue
      if (f.type === 'roll') {
        const it = stock.find((s) => s.id === raw)
        if (it) rows.push({ label: f.label, value: `${it.maker} ${it.name} · rola #${it.rollNumber}` })
        continue
      }
      rows.push({ label: f.label, value: `${raw}${f.suffix ? ` ${f.suffix}` : ''}` })
    }
  }
  return rows
}

/** Elementele bifate, cu codul produsului dacă există. */
export const checkedElements = (svc: ServiceEntry) =>
  svc.elements.filter((e) => e.checked).map((e) => (e.code ? `${e.name} (${e.code})` : e.name))

/** Consumul din stoc al unei fișe: „SunTek PPF transparentă lucioasă · #R-04 · 20 m”. */
export const rollUsageLines = (svc: ServiceEntry, stock: StockItem[]) =>
  svc.rollUsages
    .filter((u) => u.qty > 0)
    .map((u) => {
      const it = stock.find((s) => s.id === u.stockItemId)
      return it
        ? `${it.maker} ${it.name} · ${it.unit === 'buc' ? 'lot' : 'rola'} #${it.rollNumber} · ${u.qty} ${it.unit}`
        : ''
    })
    .filter(Boolean)

/** Recomandări de întreținere afișate pe PV-ul de predare, în funcție de serviciile din lucrare. */
export const careAdvice = (job: Job) => {
  const kinds = new Set(job.services.map((s) => s.kind))
  const out: string[] = []
  if (kinds.has('colantare') || kinds.has('folie_parbriz'))
    out.push(
      'Nu spălați mașina la presiune și nu folosiți spălătorii automate timp de 7 zile.',
      'Retușul foliei se face gratuit în atelier în primele 7 zile lucrătoare de la predare; neprezentarea la retuș poate afecta garanția.',
    )
  if (kinds.has('folie_geam'))
    out.push('Nu coborâți geamurile timp de 3–5 zile; aburirea ușoară dispare singură.')
  if (kinds.has('ceramica'))
    out.push('Protecția ceramică se întărește complet în 7 zile: evitați spălarea și ploaia acidă în acest interval.')
  if (kinds.has('detailing')) out.push('Folosiți doar șampon cu pH neutru și lavete din microfibră.')
  if (kinds.has('jante') || kinds.has('suspensii'))
    out.push('Verificați strângerea prezoanelor după primii 50–100 km.')
  if (kinds.has('chip_tuning')) out.push('Folosiți doar combustibil premium; păstrați backup-ul software.')
  if (out.length === 0) out.push('Reveniți la noi pentru orice nelămurire legată de lucrarea efectuată.')
  return out
}
