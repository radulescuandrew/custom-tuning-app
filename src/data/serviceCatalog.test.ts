import { describe, expect, it } from 'vitest'
import { activeServices, effectiveCarClass, gridPrice, serviceLabel, servicePrice, suggestCarClass } from './serviceCatalog'

describe('gridPrice', () => {
  it('adună interior + exterior + polish pe clasa mașinii', () => {
    const v = { interior: 'Da', exterior: 'Doi pași', polish: 'Two-step (corectiv)' }
    expect(gridPrice('detailing', v, 'medie')).toBe(700 + 700 + 2000)
    expect(gridPrice('detailing', v, 'supercar')).toBe(1300 + 1400 + 3800)
  })

  it('adună doar produsele ceramice bifate', () => {
    const v = { 'Krytex Mega 8__used': 'Da', 'Krytex Mega Glass__used': 'Da', 'Krytex 7H__used': 'Nu' }
    expect(gridPrice('ceramica', v, 'mare')).toBe(3500 + 550)
  })

  it('null când nu e nimic ales sau serviciul nu are grilă', () => {
    expect(gridPrice('detailing', { interior: 'Nu', exterior: 'Nu', polish: 'Nu' }, 'medie')).toBeNull()
    expect(gridPrice('colantare', { interior: 'Da' }, 'medie')).toBeNull()
  })
})

describe('clasa mașinii', () => {
  it('SUV-urile sunt „mare”, restul „medie”; clasa aleasă de mână câștigă', () => {
    expect(suggestCarClass('suv_mare')).toBe('mare')
    expect(suggestCarClass('coupe_sport')).toBe('medie')
    expect(effectiveCarClass({ bodyType: 'sedan', carClass: 'supercar' })).toBe('supercar')
    expect(effectiveCarClass(undefined)).toBe('medie')
  })
})

describe('serviceLabel', () => {
  it('lucrarea Custom își arată denumirea', () => {
    expect(serviceLabel({ kind: 'custom', values: { title: ' Lumini ambientale ' } })).toBe('Lumini ambientale')
    expect(serviceLabel({ kind: 'custom', values: {} })).toBe('Custom')
    expect(serviceLabel({ kind: 'detailing', values: { title: 'x' } })).toBe('Detailing')
  })
})

describe('prețuri și servicii din Setări', () => {
  it('grila suprascrisă în Setări înlocuiește valorile implicite', () => {
    const settings = { gridPrices: { 'detailing:interior': [1000, 1200, 1500] as [number, number, number] } }
    expect(gridPrice('detailing', { interior: 'Da' }, 'mare', settings)).toBe(1200)
    expect(gridPrice('detailing', { interior: 'Da', exterior: 'Un pas' }, 'mare', settings)).toBe(1200 + 500)
  })

  it('prețul orientativ și serviciile active vin din Setări', () => {
    expect(servicePrice('colantare', { servicePrice: { colantare: 9900 } })).toBe(9900)
    expect(servicePrice('colantare', {})).toBe(8900)
    const active = activeServices({ serviceDisabled: ['chip_tuning'] }).map((d) => d.kind)
    expect(active).not.toContain('chip_tuning')
    expect(active).toContain('colantare')
  })
})
