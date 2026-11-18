import type { CarBodyType, CarClass, ServiceEntry, ServiceKind, Settings, StockCategory } from './types'

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'roll'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  /** doar pentru type: 'roll' — din ce categorie de stoc se alege rola */
  stockCategory?: StockCategory
  placeholder?: string
  suffix?: string
  /** arata campul doar daca alt camp are una din valorile astea */
  showIf?: { key: string; equals: string[] }
}

export interface GroupDef {
  title: string
  fields: FieldDef[]
  /** grupurile cu același variantKey sunt alternative: se vede una singură, aleasă dintr-un toggle.
   *  Alegerea se ține în entry.values[variantKey]; câmpurile grupului ascuns se golesc la comutare. */
  variantKey?: string
  variantValue?: string
}

export interface ServiceDef {
  kind: ServiceKind
  label: string
  short: string
  accent: string
  groups: GroupDef[]
  /** are lista de elemente de caroserie (cu cod produs / cod folie per element) */
  elements: boolean
  /** urmărește retușul după predare (oferta: colantare, inclusiv folii geamuri și parbriz) */
  retouch: boolean
  defaultPrice: number
  /** manopera estimata, in minute — folosita pentru sugestia de timp de lucru */
  estimateMin: number
  /** metri de folie estimați pe un sedan (baza) — înmulțiți cu factorul caroseriei */
  estimateMeters?: number
}

/** Spec: elementele care se pot infolia / inlocui. Se pot adauga si altele din UI. */
export const BODY_ELEMENTS = [
  'Bară față',
  'Grilă bară față',
  'Lip bară față',
  'Aripi față',
  'Praguri',
  'Evazări aripi față',
  'Evazări aripi spate',
  'Bară spate',
  'Diffuser',
  'Eleron portbagaj',
  'Eleron lunetă',
  'Capotă',
  'Plafon',
  'Oglinzi',
]

export const CERAMIC_PRODUCTS = [
  'Krytex 7H',
  'Krytex Mega 8',
  'Krytex 9H + Mega 8',
  'Krytex Mega Glass',
  'Krytex Mega Leather',
  'Krytex Mega Rims',
  'Krytex Mega Tex',
]

/* ───────── grila de prețuri pe clasă de mașină (RON, orientativ, editabil în fișă) ───────── */

export const CAR_CLASSES: { value: CarClass; label: string }[] = [
  { value: 'medie', label: 'Medie' },
  { value: 'mare', label: 'Mare' },
  { value: 'supercar', label: 'Supercar' },
]

export const carClassLabel = (c: CarClass) => CAR_CLASSES.find((x) => x.value === c)!.label

/** [medie, mare, supercar] */
export type Tier = [number, number, number]
const TIER: Record<CarClass, 0 | 1 | 2> = { medie: 0, mare: 1, supercar: 2 }

export const CERAMIC_PRICES: Record<string, Tier> = {
  'Krytex 7H': [2200, 2700, 3500],
  'Krytex Mega 8': [2900, 3500, 4500],
  'Krytex 9H + Mega 8': [3800, 4600, 5900],
  'Krytex Mega Glass': [450, 550, 700],
  'Krytex Mega Leather': [600, 800, 1100],
  'Krytex Mega Rims': [700, 800, 1200],
  'Krytex Mega Tex': [400, 500, 700],
}

const INTERIOR_PRICE: Tier = [700, 900, 1300]
const EXTERIOR_PRICES: Record<string, Tier> = {
  'Un pas': [400, 500, 800],
  'Doi pași': [700, 900, 1400],
  'Trei pași': [1100, 1400, 2200],
}
export const POLISH_PRICES: Record<string, Tier> = {
  'One-step (finisare)': [1200, 1500, 2400],
  'Two-step (corectiv)': [2000, 2500, 3800],
}

/** Clasa propusă din caroserie: SUV-urile sunt „mare”; supercar se alege de mână. */
export const suggestCarClass = (bodyType?: CarBodyType | ''): CarClass =>
  bodyType === 'suv' || bodyType === 'suv_mare' ? 'mare' : 'medie'

export const effectiveCarClass = (car?: { carClass?: CarClass | ''; bodyType?: CarBodyType | '' }) =>
  car?.carClass || suggestCarClass(car?.bodyType)

/**
 * Prețul din grilă pentru o fișă de detailing / ceramică, după opțiunile bifate.
 * null = serviciul nu are grilă sau nu e nimic ales (rămâne prețul curent).
 */
/**
 * Rândurile grilei de prețuri: o opțiune din fișă → prețul ei pe cele 3 clase.
 * Valorile de aici sunt implicite; Setări → „Servicii & prețuri” le poate suprascrie.
 */
export interface GridRow {
  key: string
  kind: 'detailing' | 'ceramica'
  label: string
  base: Tier
  match: (values: Record<string, string>) => boolean
}

export const GRID_ROWS: GridRow[] = [
  { key: 'detailing:interior', kind: 'detailing', label: 'Detailing interior', base: INTERIOR_PRICE, match: (v) => v.interior === 'Da' },
  ...Object.entries(EXTERIOR_PRICES).map(([opt, base]) => ({
    key: `detailing:exterior:${opt}`,
    kind: 'detailing' as const,
    label: `Exterior · ${opt.toLowerCase()}`,
    base,
    match: (v: Record<string, string>) => v.exterior === opt,
  })),
  ...Object.entries(POLISH_PRICES).map(([opt, base]) => ({
    key: `detailing:polish:${opt}`,
    kind: 'detailing' as const,
    label: `Polish · ${opt}`,
    base,
    match: (v: Record<string, string>) => v.polish === opt,
  })),
  ...CERAMIC_PRODUCTS.map((p) => ({
    key: `ceramica:${p}`,
    kind: 'ceramica' as const,
    label: p,
    base: CERAMIC_PRICES[p],
    match: (v: Record<string, string>) => v[`${p}__used`] === 'Da',
  })),
]

/** prețurile unui rând pe cele 3 clase: din Setări dacă au fost schimbate, altfel implicite */
export const gridTier = (row: GridRow, settings?: Pick<Settings, 'gridPrices'>) =>
  settings?.gridPrices?.[row.key] ?? row.base

export const gridPrice = (
  kind: ServiceKind,
  values: Record<string, string>,
  cls: CarClass,
  settings?: Pick<Settings, 'gridPrices'>,
): number | null => {
  if (kind !== 'detailing' && kind !== 'ceramica') return null
  const t = TIER[cls]
  const sum = GRID_ROWS.filter((r) => r.kind === kind && r.match(values)).reduce(
    (acc, r) => acc + gridTier(r, settings)[t],
    0,
  )
  return sum > 0 ? sum : null
}

/** Prețul orientativ propus la adăugarea serviciului (Setări → altfel catalogul). */
export const servicePrice = (kind: ServiceKind, settings?: Pick<Settings, 'servicePrice'>) =>
  settings?.servicePrice?.[kind] ?? SERVICE_CATALOG.find((d) => d.kind === kind)!.defaultPrice

/** Serviciile oferite la programări noi (cele dezactivate din Setări nu apar). */
export const activeServices = (settings?: Pick<Settings, 'serviceDisabled'>) =>
  SERVICE_CATALOG.filter((d) => !settings?.serviceDisabled?.includes(d.kind))

/** Numele afișat al unei fișe — la „Custom” e denumirea scrisă de operator. */
export const serviceLabel = (entry: Pick<ServiceEntry, 'kind' | 'values'>) =>
  entry.kind === 'custom' && entry.values.title?.trim()
    ? entry.values.title.trim()
    : SERVICE_CATALOG.find((d) => d.kind === entry.kind)!.label

export const SERVICE_CATALOG: ServiceDef[] = [
  {
    kind: 'colantare',
    label: 'Colantare',
    short: 'PPF / Folie',
    accent: '#e02a2a',
    elements: true,
    retouch: true,
    defaultPrice: 8900,
    estimateMin: 960,
    estimateMeters: 18,
    groups: [
      {
        title: 'Folie de protecție (PPF)',
        variantKey: 'foilType',
        variantValue: 'ppf',
        fields: [{ key: 'ppfRoll', label: 'Rolă folosită', type: 'roll', stockCategory: 'ppf' }],
      },
      {
        title: 'Folie de culoare',
        variantKey: 'foilType',
        variantValue: 'color',
        fields: [
          { key: 'colorRoll', label: 'Rolă folosită', type: 'roll', stockCategory: 'folie_color' },
        ],
      },
      {
        title: 'Consum',
        fields: [
          { key: 'metersUsed', label: 'Metri de colant folosiți', type: 'number', suffix: 'm' },
          { key: 'crew', label: 'Executat de', type: 'text', placeholder: 'Andrei, Cosmin…' },
        ],
      },
    ],
  },
  {
    kind: 'folie_geam',
    label: 'Folii geamuri',
    short: 'Geamuri',
    accent: '#7d8189',
    elements: false,
    retouch: true,
    defaultPrice: 1200,
    estimateMin: 180,
    estimateMeters: 5,
    groups: [
      {
        title: 'Folie geamuri',
        fields: [
          {
            key: 'vlt',
            label: 'Grad transparență',
            type: 'select',
            options: ['—', '5%', '20%', '35%', '50%', '70%'],
          },
          { key: 'roll', label: 'Rolă folosită', type: 'roll', stockCategory: 'folie_geam' },
          {
            key: 'zones',
            label: 'Geamuri lucrate',
            type: 'select',
            options: ['—', 'Laterale spate', 'Laterale spate + lunetă', 'Toate geamurile', 'Doar lunetă'],
          },
          { key: 'metersUsed', label: 'Metri folosiți', type: 'number', suffix: 'm' },
        ],
      },
    ],
  },
  {
    kind: 'folie_parbriz',
    label: 'Folie protecție parbriz',
    short: 'Parbriz',
    accent: '#556074',
    elements: false,
    retouch: true,
    defaultPrice: 3200,
    estimateMin: 120,
    estimateMeters: 2,
    groups: [
      {
        title: 'Parbriz',
        fields: [
          { key: 'code', label: 'Cod produs', type: 'text' },
          { key: 'roll', label: 'Rolă folosită', type: 'roll', stockCategory: 'ppf' },
          { key: 'metersUsed', label: 'Metri folosiți', type: 'number', suffix: 'm' },
          { key: 'warranty', label: 'Garanție (luni)', type: 'number' },
        ],
      },
    ],
  },
  {
    kind: 'chip_tuning',
    label: 'Chip tuning',
    short: 'Chip',
    accent: '#f0a93b',
    elements: false,
    retouch: false,
    defaultPrice: 2500,
    estimateMin: 120,
    groups: [
      {
        title: 'Software',
        fields: [
          { key: 'ecu', label: 'ECU / calculator', type: 'text', placeholder: 'Bosch MG1CS201' },
          { key: 'stage', label: 'Etapă', type: 'select', options: ['—', 'Stage 1', 'Stage 2', 'Stage 3', 'Custom'] },
          { key: 'tool', label: 'Unealtă folosită', type: 'text', placeholder: 'CMD, Autotuner…' },
          { key: 'hpBefore', label: 'CP înainte', type: 'number' },
          { key: 'hpAfter', label: 'CP după', type: 'number' },
          { key: 'nmBefore', label: 'Nm înainte', type: 'number' },
          { key: 'nmAfter', label: 'Nm după', type: 'number' },
          { key: 'backup', label: 'Backup software salvat', type: 'select', options: ['Da', 'Nu'] },
          { key: 'obs', label: 'Observații / opțiuni dezactivate', type: 'textarea' },
        ],
      },
    ],
  },
  {
    kind: 'jante',
    label: 'Jante',
    short: 'Jante & anvelope',
    accent: '#9aa3ad',
    elements: false,
    retouch: false,
    defaultPrice: 2900,
    estimateMin: 120,
    groups: [
      {
        title: 'Jante',
        fields: [
          { key: 'maker', label: 'Producător jante', type: 'text' },
          { key: 'model', label: 'Model jante', type: 'text' },
          { key: 'diameter', label: 'Dimensiune', type: 'text', placeholder: '20"' },
          { key: 'width', label: 'Lățime', type: 'text', placeholder: '9J / 10.5J' },
          { key: 'et', label: 'ET', type: 'text', placeholder: 'ET35 / ET40' },
          { key: 'color', label: 'Culoare jante', type: 'text' },
          { key: 'tyres', label: 'Dimensiune anvelope', type: 'text', placeholder: '275/35 R20' },
          { key: 'description', label: 'Descriere lucrare / mențiuni', type: 'textarea' },
        ],
      },
    ],
  },
  {
    kind: 'tuning',
    label: 'Tuning',
    short: 'Piese caroserie',
    accent: '#e0562d',
    elements: true,
    retouch: false,
    defaultPrice: 12000,
    estimateMin: 600,
    groups: [
      {
        title: 'Piese',
        fields: [
          { key: 'partsMaker', label: 'Producător piese', type: 'text' },
          { key: 'material', label: 'Material', type: 'select', options: ['—', 'Carbon', 'ABS', 'Fibră de sticlă', 'PP'] },
          { key: 'description', label: 'Descriere lucrare / mențiuni', type: 'textarea' },
        ],
      },
    ],
  },
  {
    kind: 'suspensii',
    label: 'Suspensii',
    short: 'Suspensii & arcuri',
    accent: '#3ecf8e',
    elements: false,
    retouch: false,
    defaultPrice: 2400,
    estimateMin: 300,
    groups: [
      {
        title: 'Suspensie',
        fields: [
          { key: 'maker', label: 'Producător suspensii', type: 'text', placeholder: 'KW, Bilstein…' },
          { key: 'model', label: 'Model suspensii', type: 'text' },
          { key: 'code', label: 'Cod suspensie', type: 'text' },
        ],
      },
      {
        title: 'Amortizoare',
        fields: [
          { key: 'shockFL', label: 'Cod amortizor față stânga', type: 'text' },
          { key: 'shockFR', label: 'Cod amortizor față dreapta', type: 'text' },
          { key: 'shockRL', label: 'Cod amortizor spate stânga', type: 'text' },
          { key: 'shockRR', label: 'Cod amortizor spate dreapta', type: 'text' },
        ],
      },
      {
        title: 'Arcuri',
        fields: [
          { key: 'springMaker', label: 'Producător arcuri', type: 'text' },
          { key: 'springCode', label: 'Cod arcuri', type: 'text' },
          { key: 'springFL', label: 'Cod arc față stânga', type: 'text' },
          { key: 'springFR', label: 'Cod arc față dreapta', type: 'text' },
          { key: 'springRL', label: 'Cod arc spate stânga', type: 'text' },
          { key: 'springRR', label: 'Cod arc spate dreapta', type: 'text' },
        ],
      },
      {
        title: 'Sigilare',
        fields: [
          {
            key: 'markerColor',
            label: 'Culoare marker sigiliu șuruburi',
            type: 'select',
            options: ['—', 'Galben', 'Roșu', 'Alb', 'Verde', 'Albastru'],
          },
          { key: 'torque', label: 'Cuplu strângere / observații', type: 'textarea' },
        ],
      },
    ],
  },
  {
    kind: 'evacuare',
    label: 'Evacuare',
    short: 'Sistem evacuare',
    accent: '#c9a227',
    elements: false,
    retouch: false,
    defaultPrice: 5500,
    estimateMin: 240,
    groups: [
      {
        title: 'Evacuare',
        fields: [
          { key: 'maker', label: 'Producător evacuare', type: 'text', placeholder: 'Akrapovič, Remus…' },
          { key: 'code', label: 'Cod evacuare', type: 'text' },
          { key: 'valves', label: 'Valve / telecomandă', type: 'select', options: ['—', 'Da', 'Nu'] },
          { key: 'description', label: 'Descriere lucrare / mențiuni', type: 'textarea' },
        ],
      },
    ],
  },
  {
    kind: 'detailing',
    label: 'Detailing',
    short: 'Detailing',
    accent: '#5b8def',
    elements: false,
    retouch: false,
    defaultPrice: 1900,
    estimateMin: 480,
    groups: [
      {
        title: 'Pachet',
        fields: [
          {
            key: 'interior',
            label: 'Detailing interior',
            type: 'select',
            options: ['Nu', 'Da'],
          },
          {
            key: 'exterior',
            label: 'Detailing exterior',
            type: 'select',
            options: ['Nu', 'Un pas', 'Doi pași', 'Trei pași'],
          },
          {
            key: 'polish',
            label: 'Polish',
            type: 'select',
            options: ['Nu', ...Object.keys(POLISH_PRICES)],
          },
          { key: 'crew', label: 'Executat de', type: 'text' },
          { key: 'obs', label: 'Observații', type: 'textarea' },
        ],
      },
    ],
  },
  {
    kind: 'ceramica',
    label: 'Protecții ceramice',
    short: 'Ceramică',
    accent: '#b05cd6',
    elements: false,
    retouch: false,
    defaultPrice: 3500,
    estimateMin: 300,
    groups: [
      {
        title: 'Produse aplicate',
        fields: CERAMIC_PRODUCTS.flatMap<FieldDef>((p) => [
          { key: `${p}__used`, label: p, type: 'select', options: ['Nu', 'Da'] },
          {
            key: `${p}__code`,
            label: `${p} · cod sticlă`,
            type: 'text',
            showIf: { key: `${p}__used`, equals: ['Da'] },
          },
        ]),
      },
    ],
  },
  {
    kind: 'custom',
    label: 'Custom',
    short: 'Lucrare la cerere',
    accent: '#6b7280',
    elements: false,
    retouch: false,
    /** fără preț orientativ — se completează de mână (oferta) */
    defaultPrice: 0,
    estimateMin: 120,
    groups: [
      {
        title: 'Lucrare',
        fields: [
          {
            key: 'title',
            label: 'Denumire lucrare',
            type: 'text',
            placeholder: 'Montaj lumini ambientale, body kit custom…',
          },
          { key: 'description', label: 'Descriere', type: 'textarea' },
          { key: 'parts', label: 'Piese / coduri produs', type: 'textarea', placeholder: 'opțional' },
          { key: 'hours', label: 'Durată estimată', type: 'number', suffix: 'ore' },
        ],
      },
    ],
  },
]

export const serviceDef = (kind: ServiceKind) =>
  SERVICE_CATALOG.find((s) => s.kind === kind)!

/** Câmpurile de tip rolă ale unui serviciu (colantare, folii) — din ele se scade stocul. */
export const rollFields = (kind: ServiceKind) =>
  serviceDef(kind)
    .groups.flatMap((g) => g.fields)
    .filter((f) => f.type === 'roll')

/** Tipurile de caroserie și factorul de timp implicit — configurabil din Setări. */
export const CAR_TYPES: { value: CarBodyType; label: string; defaultFactor: number }[] = [
  { value: 'compacta', label: 'Compactă', defaultFactor: 0.85 },
  { value: 'sedan', label: 'Sedan', defaultFactor: 1 },
  { value: 'break', label: 'Break', defaultFactor: 1.1 },
  { value: 'coupe_sport', label: 'Coupé / Sport', defaultFactor: 1 },
  { value: 'suv', label: 'SUV', defaultFactor: 1.25 },
  { value: 'suv_mare', label: 'SUV mare / Van', defaultFactor: 1.4 },
]

export const carTypeLabel = (t?: CarBodyType | '') =>
  CAR_TYPES.find((c) => c.value === t)?.label

/** Durata de bază a unui serviciu: din Setări dacă e configurată, altfel din catalog. */
export const serviceBaseMin = (kind: ServiceKind, settings?: Settings) =>
  settings?.serviceDurationMin?.[kind] || serviceDef(kind).estimateMin

/**
 * Estimare manoperă pentru un set de servicii.
 * Serviciile se execută secvențial, dar peste primul se adaugă doar 85% din restul
 * (echipa lucrează în paralel pe zone diferite ale mașinii).
 * Duratele de bază vin din Setări (dacă sunt configurate), înmulțite cu factorul
 * tipului de caroserie (SUV durează mai mult decât o compactă).
 */
export const bodyFactor = (settings?: Settings, bodyType?: CarBodyType | '') =>
  (bodyType && settings?.carTypeFactor?.[bodyType]) ||
  (bodyType && CAR_TYPES.find((c) => c.value === bodyType)?.defaultFactor) ||
  1

/** Consum estimat de folie: baza serviciului × factorul caroseriei, rotunjit la 0.5m. */
export const estimateFoilMeters = (
  kind: ServiceKind,
  settings?: Settings,
  bodyType?: CarBodyType | '',
) => {
  const base = serviceDef(kind).estimateMeters
  return base ? Math.round(base * bodyFactor(settings, bodyType) * 2) / 2 : 0
}

export const estimateMinutes = (
  kinds: ServiceKind[],
  settings?: Settings,
  bodyType?: CarBodyType | '',
) => {
  if (!kinds.length) return 0
  const factor = bodyFactor(settings, bodyType)
  const mins = kinds.map((k) => serviceBaseMin(k, settings) * factor).sort((a, b) => b - a)
  return Math.round(mins[0] + mins.slice(1).reduce((s, m) => s + m * 0.85, 0))
}

/** Estimarea rotunjită la sfert de oră, minim 30 min. */
export const estimateRounded = (
  kinds: ServiceKind[],
  settings?: Settings,
  bodyType?: CarBodyType | '',
) => Math.max(30, Math.round(estimateMinutes(kinds, settings, bodyType) / 15) * 15)
