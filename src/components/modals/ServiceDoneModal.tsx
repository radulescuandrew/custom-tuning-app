import { useEffect, useRef, useState } from 'react'
import { Button, Field, Modal, Textarea } from '@/components/ui'
import { IconCamera, IconX } from '@/components/Icons'
import type { JobPhoto, ServiceEntry } from '@/data/types'
import { serviceLabel } from '@/data/serviceCatalog'
import { savePhoto } from '@/lib/photos'
import { cx, uid } from '@/lib/utils'

type Pending = { id: string; file: File; url: string }

/**
 * Finalizarea unui serviciu în timpul execuției: poze „după” + un mesaj opțional.
 * Pozele marcate vizibile apar pe pagina de tracking, sub serviciul respectiv.
 * Se montează doar cât e deschis, deci pornește mereu gol.
 */
export default function ServiceDoneModal({
  service,
  onClose,
  onDone,
}: {
  service: ServiceEntry
  onClose: () => void
  onDone: (data: { note: string; photos: JobPhoto[] }) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<Pending[]>([])
  const [note, setNote] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)
  const label = serviceLabel(service)

  // previzualizările locale se eliberează doar la închidere (nu la fiecare poză adăugată)
  const latest = useRef(files)
  latest.current = files
  useEffect(() => () => latest.current.forEach((f) => URL.revokeObjectURL(f.url)), [])

  const add = (list: FileList | null) => {
    if (!list?.length) return
    setFiles((prev) => [
      ...prev,
      ...Array.from(list).map((file) => ({ id: uid(), file, url: URL.createObjectURL(file) })),
    ])
    if (input.current) input.current.value = ''
  }

  const confirm = async () => {
    setBusy(true)
    const now = new Date().toISOString()
    const photos: JobPhoto[] = []
    for (const f of files) {
      const key = await savePhoto(f.id, f.file)
      photos.push({
        id: f.id,
        key,
        name: f.file.name,
        caption: note.trim() || `${label} — finalizat`,
        createdAt: now,
        public: isPublic,
        serviceId: service.id,
      })
    }
    setBusy(false)
    onDone({ note: note.trim(), photos })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${label} · serviciu finalizat`}
      subtitle="Adaugă poze cu rezultatul — clientul le vede pe pagina de tracking."
      footer={
        <>
          <Button onClick={onClose}>Renunță</Button>
          <Button variant="primary" disabled={busy} onClick={confirm}>
            {busy ? 'Se salvează…' : files.length ? `Finalizează cu ${files.length} poze` : 'Finalizează fără poze'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {files.map((f) => (
            <figure key={f.id} className="relative overflow-hidden rounded-lg border border-line">
              <img src={f.url} alt={f.file.name} className="aspect-square w-full object-cover" />
              <button
                onClick={() => {
                  URL.revokeObjectURL(f.url)
                  setFiles((prev) => prev.filter((x) => x.id !== f.id))
                }}
                aria-label="Scoate poza"
                className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white"
              >
                <IconX width={12} height={12} />
              </button>
            </figure>
          ))}
          <button
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-fg-faint transition hover:border-brand-500/50 hover:text-brand-500"
          >
            <IconCamera width={20} height={20} />
            <span className="text-[11.5px] font-semibold">Adaugă poze</span>
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          hidden
          onChange={(e) => add(e.target.files)}
        />

        <Field label="Mesaj pentru client (opțional)" hint="Apare pe tracking, sub serviciu.">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: PPF aplicat pe bară, capotă și aripi — urmează protecția ceramică."
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand-500)]"
          />
          <span className={cx(!isPublic && 'text-fg-mute')}>Pozele apar pe pagina clientului</span>
        </label>
      </div>
    </Modal>
  )
}
