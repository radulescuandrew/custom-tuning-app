import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, activeFilterCount } from './CalendarFilters'

describe('activeFilterCount', () => {
  it('nu numără nimic pe starea implicită', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
  })

  it('numără un strat stins', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, layers: ['primire'] })).toBe(1)
  })

  it('numără un strat aprins în plus', () => {
    expect(
      activeFilterCount({ ...DEFAULT_FILTERS, layers: ['primire', 'executie', 'concedii'] }),
    ).toBe(1)
  })

  it('numără operatorul, statusul și căutarea separat', () => {
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        who: 'Robert',
        status: 'in_lucru',
        q: 'golf',
      }),
    ).toBe(3)
  })

  it('ignoră o căutare formată doar din spații', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, q: '   ' })).toBe(0)
  })
})
