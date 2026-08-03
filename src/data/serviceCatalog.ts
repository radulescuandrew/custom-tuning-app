import type { ServiceKind, StockCategory } from './types'

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
}

export interface ServiceDef {
  kind: ServiceKind
  label: string
  short: string
  accent: string
  groups: GroupDef[]
  /** are lista de elemente de caroserie (cu cod produs / cod folie per element) */
  elements: boolean
  /** urmareste retusul la 7 zile lucratoare (spec: colantare) */
  retouch: boolean
  defaultPrice: number
  /** manopera estimata, in minute — folosita pentru sugestia de timp de lucru */
  estimateMin: number
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
    groups: [
      {
        title: 'Folie de protecție (PPF)',
        fields: [
          { key: 'ppfMaker', label: 'Producător', type: 'text', placeholder: 'SunTek, XPEL, STEK…' },
          { key: 'ppfFinish', label: 'Finisaj', type: 'select', options: ['—', 'Lucioasă', 'Mată'] },
          { key: 'ppfRoll', label: 'Rolă folosită', type: 'roll', stockCategory: 'ppf' },
        ],
      },
      {
        title: 'Folie de culoare',
        fields: [
          { key: 'colorMaker', label: 'Producător', type: 'text', placeholder: 'Avery, 3M, KPMF…' },
          { key: 'colorName', label: 'Nume culoare', type: 'text', placeholder: 'Satin Dark Grey' },
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
    retouch: false,
    defaultPrice: 1200,
    estimateMin: 180,
    groups: [
      {
        title: 'Folie geamuri',
        fields: [
          { key: 'maker', label: 'Producător', type: 'text', placeholder: 'LLumar, 3M…' },
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
    retouch: false,
    defaultPrice: 3200,
    estimateMin: 120,
    groups: [
      {
        title: 'Parbriz',
        fields: [
          { key: 'maker', label: 'Producător', type: 'text', placeholder: 'STEK, ExoShield…' },
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
]

export const serviceDef = (kind: ServiceKind) =>
  SERVICE_CATALOG.find((s) => s.kind === kind)!

/**
 * Estimare manoperă pentru un set de servicii.
 * Serviciile se execută secvențial, dar peste primul se adaugă doar 85% din restul
 * (echipa lucrează în paralel pe zone diferite ale mașinii).
 */
export const estimateMinutes = (kinds: ServiceKind[]) => {
  if (!kinds.length) return 0
  const mins = kinds.map((k) => serviceDef(k).estimateMin).sort((a, b) => b - a)
  return Math.round(mins[0] + mins.slice(1).reduce((s, m) => s + m * 0.85, 0))
}

/** Estimarea rotunjită la sfert de oră, minim 30 min. */
export const estimateRounded = (kinds: ServiceKind[]) =>
  Math.max(30, Math.round(estimateMinutes(kinds) / 15) * 15)
