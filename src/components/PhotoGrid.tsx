import { useEffect, useRef, useState } from 'react'
import type { JobPhoto } from '@/data/types'
import { dropPhoto, photoUrl, savePhoto } from '@/lib/photos'
import { cx, uid } from '@/lib/utils'
import { Button } from './ui'
import { IconCamera, IconTrash } from './Icons'

function Thumb({
  photo,
  onDelete,
  onTogglePublic,
}: {
  photo: JobPhoto
  onDelete: () => void
  onTogglePublic?: () => void
}) {
  const isPublic = photo.public !== false
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
      <figcaption className="px-2 pt-1.5 text-[11.5px] leading-snug text-fg-dim">
        <span className="line-clamp-2">{photo.caption || photo.name}</span>
      </figcaption>
      {onTogglePublic && (
        <button
          onClick={onTogglePublic}
          title={isPublic ? 'Clientul vede poza pe pagina de tracking' : 'Poza rămâne doar în atelier'}
          className={cx(
            'mx-2 mt-1 mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition',
            isPublic ? 'bg-mint/12 text-mint' : 'bg-black/[0.06] text-fg-faint',
          )}
        >
          <span
            className={cx(
              'h-1.5 w-1.5 rounded-full',
              isPublic ? 'bg-mint' : 'bg-fg-faint',
            )}
          />
          {isPublic ? 'vizibilă clientului' : 'internă'}
        </button>
      )}
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
  onTogglePublic,
}: {
  photos: JobPhoto[]
  onAdd: (p: JobPhoto) => void
  onRemove: (id: string) => void
  /** dacă lipsește, nu se afișează comutatorul de vizibilitate */
  onTogglePublic?: (id: string) => void
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
            onTogglePublic={onTogglePublic && (() => onTogglePublic(p.id))}
          />
        ))}
        <button
          onClick={() => input.current?.click()}
          className="flex min-h-[126px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-fg-faint transition hover:border-brand-500/50 hover:text-brand-400"
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
          {photos.filter((p) => p.public !== false).length} din {photos.length} poze apar pe pagina
          de tracking a clientului.
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
