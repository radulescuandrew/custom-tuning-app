import type { Settings } from '@/data/types'

/** Descompunerea unei sume în bază + TVA, în funcție de setările firmei. */
export interface Amounts {
  /** baza de impozitare (fără TVA) */
  net: number
  vat: number
  /** total de plată (cu TVA) */
  gross: number
  /** cota aplicată, ca fracție (0.21) */
  rate: number
  /** false = firmă neplătitoare de TVA — nu se afișează nicio linie de TVA */
  showsVat: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * `value` este suma introdusă în fișă. Interpretarea ei depinde de
 * `settings.pricesIncludeVat`: preț final (se scoate TVA-ul din el) sau preț de bază
 * (se adaugă TVA peste).
 */
export const amounts = (value: number, s: Settings): Amounts => {
  const v = value || 0
  const rate = s.vatPayer ? s.vatRate / 100 : 0
  if (!rate) return { net: round2(v), vat: 0, gross: round2(v), rate: 0, showsVat: false }
  if (s.pricesIncludeVat) {
    const net = round2(v / (1 + rate))
    return { net, vat: round2(v - net), gross: round2(v), rate, showsVat: true }
  }
  const vat = round2(v * rate)
  return { net: round2(v), vat, gross: round2(v + vat), rate, showsVat: true }
}

/** „8.900 RON” / „7.355,37 RON” */
export const fmtRon = (n: number) => {
  const v = round2(n || 0)
  return `${v.toLocaleString('ro-RO', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })} RON`
}

export const vatLabel = (s: Settings) => `TVA ${s.vatRate}%`

/** Ce înseamnă suma afișată — se pune ca notă sub totaluri. */
export const vatNote = (s: Settings) =>
  !s.vatPayer ? 'firmă neplătitoare de TVA' : `TVA ${s.vatRate}% inclus`

/** Eticheta câmpului de preț din fișele de serviciu. */
export const priceFieldLabel = (s: Settings) =>
  !s.vatPayer
    ? 'Preț serviciu (RON)'
    : s.pricesIncludeVat
      ? 'Preț serviciu (RON, cu TVA)'
      : 'Preț serviciu (RON, fără TVA)'
