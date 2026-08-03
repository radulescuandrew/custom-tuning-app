import { useEffect, useRef, useState } from 'react'
import type { JobPhoto } from '@/data/types'
import { dropPhoto, photoUrl, savePhoto } from '@/lib/photos'
import { uid } from '@/lib/utils'
import { Button } from './ui'
import { IconCamera, IconTrash } from './Icons'

function Thumb({ photo, onDelete }: { photo: JobPhoto; onDelete: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    photoUrl(photo.key).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [photo.key])

  return (
    <figure className="group relative overflow-hidden rounded-lg border border-line bg-ink-900">
      {url ? (
        <img src={url} alt={photo.caption || photo.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center text-[11px] text-fg-faint">…</div>
      )}
      <figcaption className="truncate px-2 py-1.5 font-mono text-[10.5px] text-fg-faint">
        {photo.name}
      </figcaption>
      <button
        onClick={onDelete}
        className="absolute top-1.5 right-1.5 rounded-md bg-black/70 p-1 text-fg-mute opacity-0 transition group-hover:opacity-100 hover:text-rose"
      >
        <IconTrash width={14} height={14} />
      </button>
    </figure>
  )
}

export default function PhotoGrid({
  photos,
  onAdd,
  onRemove,
}: {
  photos: JobPhoto[]
  onAdd: (p: JobPhoto) => void
  onRemove: (id: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handle = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    for (const file of Array.from(files)) {
      const id = uid()
      const key = await savePhoto(id, file)
      onAdd({ id, key, name: file.name, caption: '', createdAt: new Date().toISOString() })
    }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {photos.map((p) => (
          <Thumb
            key={p.id}
            photo={p}
            onDelete={async () => {
              await dropPhoto(p.key)
              onRemove(p.id)
            }}
          />
        ))}
        <button
          onClick={() => input.current?.click()}
          className="flex h-[126px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-fg-faint transition hover:border-brand-500/50 hover:text-brand-400"
        >
          <IconCamera width={20} height={20} />
          <span className="text-[12px] font-semibold">{busy ? 'Se încarcă…' : 'Adaugă poze'}</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
      {photos.length > 0 && (
        <p className="mt-2 text-[11.5px] text-fg-faint">
          {photos.length} poze salvate local (IndexedDB). În producție merg în storage-ul contului.
        </p>
      )}
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={() => input.current?.click()}>
          Încarcă din fișier
        </Button>
      </div>
    </div>
  )
}
