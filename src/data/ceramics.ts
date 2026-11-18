import { CERAMIC_PRODUCTS } from './serviceCatalog'
import type { ServiceEntry, StockItem } from './types'

export interface CeramicUse {
  product: string
  /** codul sticlei scris în fișă */
  code: string
  /** lotul din stoc din care se scade; null = produsul nu e în stoc */
  item: StockItem | null
}

/**
 * Produsele ceramice bifate într-o fișă și lotul din stoc corespunzător:
 * întâi lotul cu același cod ca sticla din fișă, altfel primul lot al produsului cu stoc.
 */
export const ceramicUses = (svc: ServiceEntry, stock: StockItem[]): CeramicUse[] => {
  if (svc.kind !== 'ceramica') return []
  return CERAMIC_PRODUCTS.filter((p) => svc.values[`${p}__used`] === 'Da').map((product) => {
    const code = (svc.values[`${product}__code`] ?? '').trim()
    const lots = stock.filter((i) => i.category === 'ceramica' && i.name === product)
    const item =
      (code && lots.find((i) => i.rollNumber.toLowerCase() === code.toLowerCase())) ||
      lots.find((i) => i.qty > 0) ||
      null
    return { product, code, item }
  })
}
