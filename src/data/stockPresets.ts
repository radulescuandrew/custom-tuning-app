import type { StockCategory, StockItem } from './types'

/** Furnizorii cu care se lucrează, pe categorie. Se completează cu cei deja existenți în stoc. */
export const SUPPLIERS: Record<StockCategory, string[]> = {
  ppf: ['SunTek', 'XPEL', 'STEK', 'LLumar', '3M', 'Hexis'],
  folie_color: ['Avery Dennison', '3M', 'KPMF', 'Hexis', 'Oracal', 'Inozetek'],
  folie_geam: ['LLumar', '3M', 'Solar Gard', 'Global Window Films'],
  ceramica: ['Krytex', 'Gtechniq', 'CarPro', 'Gyeon'],
  consumabile: ['3M', 'Koch Chemie', 'Nanolex', 'Generic'],
}

export interface StockPreset {
  label: string
  category: StockCategory
  maker: string
  name: string
  finish: StockItem['finish']
  width: string
  unit: StockItem['unit']
  minQty: number
  location: string
}

const ppf = (maker: string, name: string, finish: StockItem['finish'], width: string): StockPreset => ({
  label: `${maker} · ${name} ${width}m`,
  category: 'ppf',
  maker,
  name,
  finish,
  width,
  unit: 'm',
  minQty: 15,
  location: 'Raft A1',
})

const color = (maker: string, name: string, finish: StockItem['finish']): StockPreset => ({
  label: `${maker} · ${name}`,
  category: 'folie_color',
  maker,
  name,
  finish,
  width: '1.52',
  unit: 'm',
  minQty: 10,
  location: 'Raft B1',
})

const geam = (maker: string, pct: string): StockPreset => ({
  label: `${maker} · folie geamuri ${pct}`,
  category: 'folie_geam',
  maker,
  name: `Folie geamuri ${pct}`,
  finish: '',
  width: '1.52',
  unit: 'm',
  minQty: 12,
  location: 'Raft C1',
})

const ceramic = (name: string, maker = 'Krytex'): StockPreset => ({
  label: `${maker} · ${name}`,
  category: 'ceramica',
  maker,
  name,
  finish: '',
  width: '',
  unit: 'buc',
  minQty: 2,
  location: 'Dulap ceramice',
})

/** Produsele uzuale din atelier — completează tot formularul dintr-un click. */
export const STOCK_PRESETS: StockPreset[] = [
  ppf('SunTek', 'PPF transparentă lucioasă', 'lucioasa', '1.52'),
  ppf('SunTek', 'PPF transparentă mată', 'mata', '1.52'),
  ppf('STEK', 'PPF transparentă lucioasă', 'lucioasa', '1.82'),
  ppf('XPEL', 'PPF Ultimate Plus', 'lucioasa', '1.52'),
  ppf('STEK', 'Folie protecție parbriz', '', '0.90'),

  color('Avery Dennison', 'Satin Dark Grey', 'mata'),
  color('Avery Dennison', 'Gloss Black', 'lucioasa'),
  color('3M', 'Gloss Black 2080', 'lucioasa'),
  color('3M', 'Satin White 2080', 'mata'),
  color('KPMF', 'Matte Anthracite', 'mata'),
  color('Inozetek', 'Super Gloss Midnight Blue', 'lucioasa'),

  geam('LLumar', '20%'),
  geam('LLumar', '35%'),
  geam('LLumar', '5%'),
  geam('3M', '20%'),

  ceramic('Krytex 7H'),
  ceramic('Krytex Mega 8'),
  ceramic('Krytex 9H + Mega 8'),
  ceramic('Krytex Mega Glass'),
  ceramic('Krytex Mega Leather'),
  ceramic('Krytex Mega Rims'),
  ceramic('Krytex Mega Tex'),

  {
    label: '3M · lame racletă / consumabile',
    category: 'consumabile',
    maker: '3M',
    name: 'Lame racletă',
    finish: '',
    width: '',
    unit: 'buc',
    minQty: 10,
    location: 'Raft D1',
  },
  {
    label: 'Koch Chemie · soluție montaj folie',
    category: 'consumabile',
    maker: 'Koch Chemie',
    name: 'Soluție montaj folie',
    finish: '',
    width: '',
    unit: 'buc',
    minQty: 4,
    location: 'Raft D1',
  },
]

/** Prefixul numerelor de rolă, pe categorie (R-04, C-21, G-02, KX-99182). */
const ROLL_PREFIX: Record<StockCategory, string> = {
  ppf: 'R-',
  folie_color: 'C-',
  folie_geam: 'G-',
  ceramica: 'KX-',
  consumabile: 'X-',
}

/** Următorul număr liber din categoria respectivă — ca operatorul să nu-l inventeze. */
export const nextRollNumber = (category: StockCategory, stock: StockItem[]) => {
  const prefix = ROLL_PREFIX[category]
  const used = stock
    .filter((i) => i.category === category && i.rollNumber.startsWith(prefix))
    .map((i) => Number(i.rollNumber.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
  const next = (used.length ? Math.max(...used) : 0) + 1
  return `${prefix}${category === 'ceramica' ? next : String(next).padStart(2, '0')}`
}

/** Furnizori cunoscuți: cei presetați + cei deja folosiți în stoc. */
export const knownSuppliers = (category: StockCategory, stock: StockItem[]) =>
  [
    ...new Set([
      ...SUPPLIERS[category],
      ...stock.filter((i) => i.category === category && i.maker).map((i) => i.maker),
    ]),
  ].sort((a, b) => a.localeCompare(b, 'ro'))

/** Locațiile deja folosite în depozit. */
export const knownLocations = (stock: StockItem[]) =>
  [...new Set([...stock.map((i) => i.location).filter(Boolean), ...STOCK_PRESETS.map((p) => p.location)])].sort()
