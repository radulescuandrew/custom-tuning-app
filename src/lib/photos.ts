import { del, get, set } from 'idb-keyval'

/**
 * Pozele stau in IndexedDB (blob), nu in localStorage — altfel se umple quota de 5MB.
 * In store se tine doar cheia.
 */
const KEY = (id: string) => `ct-photo:${id}`

export const savePhoto = async (id: string, file: File | Blob) => {
  await set(KEY(id), file)
  return KEY(id)
}

const cache = new Map<string, string>()

/** Pozele din datele demo sunt fișiere statice din public/demo („demo:demo/x.svg”). */
const DEMO = 'demo:'

export const photoUrl = async (key: string) => {
  if (key.startsWith(DEMO)) return `${import.meta.env.BASE_URL}${key.slice(DEMO.length)}`
  const hit = cache.get(key)
  if (hit) return hit
  const blob = await get<Blob>(key)
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  cache.set(key, url)
  return url
}

export const dropPhoto = async (key: string) => {
  if (key.startsWith(DEMO)) return
  const url = cache.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    cache.delete(key)
  }
  await del(key)
}
