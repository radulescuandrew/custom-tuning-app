import { PageHeader } from '@/components/PageHeader'
import { Card, Field, Input, Select } from '@/components/ui'
import { IconWarn } from '@/components/Icons'
import { ROLE_LABEL, canEditSettings, useCurrentUser, useStore } from '@/data/store'
import { SERVICE_CATALOG } from '@/data/serviceCatalog'
import { amounts, fmtRon, vatLabel } from '@/lib/money'

/** Cotele de TVA din România — standard 21%, reduse 11% (+ 0% pentru neplătitori). */
const VAT_RATES = [21, 11, 9, 5]

export default function SettingsPage() {
  const me = useCurrentUser()
  const { settings, updateSettings, toast } = useStore()

  if (!canEditSettings(me?.role))
    return (
      <Card>
        <div className="flex items-center gap-3">
          <IconWarn className="text-ember" />
          <div>
            <p className="font-semibold">Acces restricționat</p>
            <p className="text-[13px] text-fg-mute">
              Setările firmei se schimbă doar de owner sau manager. Ești logat ca {me?.name} (
              {ROLE_LABEL[me?.role ?? 'operator']}).
            </p>
          </div>
        </div>
      </Card>
    )

  const sample = amounts(SERVICE_CATALOG[0].defaultPrice, settings)

  return (
    <>
      <PageHeader
        title="Setări"
        subtitle="Datele firmei și regimul de TVA — se aplică peste tot unde apar prețuri"
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Card title="Firmă">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Denumire">
                <Input
                  value={settings.companyName}
                  onChange={(e) => updateSettings({ companyName: e.target.value })}
                />
              </Field>
              <Field label="CUI / RO">
                <Input
                  value={settings.vatId}
                  onChange={(e) => updateSettings({ vatId: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card title="TVA">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Regim"
                hint="Neplătitor = nu se afișează nicio linie de TVA în aplicație."
              >
                <Select
                  value={settings.vatPayer ? 'da' : 'nu'}
                  onChange={(e) => {
                    updateSettings({ vatPayer: e.target.value === 'da' })
                    toast('Regim TVA actualizat', 'info')
                  }}
                >
                  <option value="da">Plătitor de TVA</option>
                  <option value="nu">Neplătitor de TVA</option>
                </Select>
              </Field>

              <Field label="Cotă" hint="Standard în România: 21% (de la 1 august 2025).">
                <Select
                  value={String(settings.vatRate)}
                  disabled={!settings.vatPayer}
                  onChange={(e) => updateSettings({ vatRate: Number(e.target.value) || 21 })}
                >
                  {VAT_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Prețurile din fișe sunt…"
                hint="Alege cum introduc operatorii prețul serviciului. Restul se calculează."
                className="sm:col-span-2"
              >
                <Select
                  value={settings.pricesIncludeVat ? 'cu' : 'fara'}
                  disabled={!settings.vatPayer}
                  onChange={(e) => updateSettings({ pricesIncludeVat: e.target.value === 'cu' })}
                >
                  <option value="cu">Prețuri finale, cu TVA inclus (recomandat pentru clienți PF)</option>
                  <option value="fara">Prețuri de bază, fără TVA (se adaugă la total)</option>
                </Select>
              </Field>
            </div>
          </Card>
        </div>

        <Card title="Cum arată un preț">
          <p className="text-[13px] text-fg-mute">
            Exemplu: {SERVICE_CATALOG[0].label}, preț introdus în fișă{' '}
            <span className="font-mono">{fmtRon(SERVICE_CATALOG[0].defaultPrice)}</span>.
          </p>
          <div className="mt-4 space-y-1.5">
            {sample.showsVat && (
              <>
                <Row label="Subtotal (fără TVA)" value={fmtRon(sample.net)} />
                <Row label={vatLabel(settings)} value={fmtRon(sample.vat)} />
              </>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-1.5">
              <span className="mono-label text-fg-mute">Total de plată</span>
              <span className="text-xl font-extrabold text-brand-400">{fmtRon(sample.gross)}</span>
            </div>
          </div>
          <p className="mt-4 text-[12px] text-fg-faint">
            Moneda este RON peste tot: fișe, calendar, rapoarte, pagina de tracking și fișa PDF.
          </p>
        </Card>
      </div>
    </>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-4 text-[13px]">
    <span className="text-fg-mute">{label}</span>
    <span className="font-mono text-fg-dim">{value}</span>
  </div>
)
