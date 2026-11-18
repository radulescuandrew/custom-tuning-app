import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Car,
  Client,
  DB,
  ID,
  Job,
  JobEvent,
  JobEventKind,
  JobPhoto,
  JobStatus,
  Notification,
  NotificationChannel,
  NotificationKind,
  Role,
  ServiceEntry,
  Settings,
  StaffMember,
  StockItem,
  TimeOff,
  TimeOffType,
} from './types'
import { buildSeed, defaultSettings } from './seed'
import { ceramicUses } from './ceramics'
import { estimateRounded, serviceDef, serviceLabel } from './serviceCatalog'
import { addBusinessDays, businessDaysBetween, fmtDate, fmtDateTime, uid } from '@/lib/utils'
import { addDays, addMonths, differenceInCalendarDays, parseISO, setHours, startOfDay } from 'date-fns'

const CURRENT_USER = 'Cosmin'

export interface Toast {
  id: string
  text: string
  tone: 'ok' | 'warn' | 'info'
}

interface Actions {
  reset: () => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void

  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => Client
  updateClient: (id: ID, patch: Partial<Client>) => void
  /** oferta: „ștergerea unui client cu păstrarea istoricului” */
  archiveClient: (id: ID) => void
  restoreClient: (id: ID) => void

  addCar: (c: Omit<Car, 'id' | 'createdAt'>) => Car
  updateCar: (id: ID, patch: Partial<Car>) => void
  removeCar: (id: ID) => void

  addJob: (
    j: Omit<
      Job,
      | 'id'
      | 'code'
      | 'createdAt'
      | 'events'
      | 'trackingToken'
      | 'completedAt'
      | 'workStartAt'
      | 'workEndAt'
      | 'estimateMin'
      | 'estimateManual'
      | 'actualStartAt'
      | 'actualEndAt'
    > &
      Partial<Pick<Job, 'workStartAt' | 'workEndAt' | 'estimateMin' | 'estimateManual'>>,
  ) => Job
  updateJob: (id: ID, patch: Partial<Job>) => void
  removeJob: (id: ID) => void
  setJobStatus: (id: ID, status: JobStatus) => void
  addJobPhoto: (id: ID, photo: JobPhoto) => void
  removeJobPhoto: (jobId: ID, photoId: ID) => void
  updateJobPhoto: (jobId: ID, photoId: ID, patch: Partial<JobPhoto>) => void
  /** un serviciu e gata: se marchează, se atașează pozele „după” și mesajul pentru client */
  completeService: (jobId: ID, serviceId: ID, data: { note: string; photos: JobPhoto[] }) => void
  reopenService: (jobId: ID, serviceId: ID) => void

  addStockItem: (s: Omit<StockItem, 'id' | 'createdAt'>) => StockItem
  updateStockItem: (id: ID, patch: Partial<StockItem>) => void
  removeStockItem: (id: ID) => void
  adjustStock: (id: ID, delta: number, reason: string, jobId?: ID | null) => void
  /** aplică toate consumurile de rolă neaplicate ale unei lucrări */
  applyRollUsages: (jobId: ID) => number
  /** scade din stoc câte o sticlă pentru fiecare produs ceramic bifat în fișe (o singură dată) */
  consumeCeramics: (jobId: ID) => void

  /** pornește execuția: marchează ora reală de start și trece în „În lucru” */
  /** mașina a ajuns în atelier — se confirmă de mână, nu la crearea programării */
  markReceived: (id: ID) => void
  startExecution: (id: ID) => void
  /** oprește execuția: marchează ora reală de final și trece în „Finalizat” */
  finishExecution: (id: ID) => void

  setCurrentUser: (id: ID) => void
  updateSettings: (patch: Partial<Settings>) => void
  addTimeOff: (t: Omit<TimeOff, 'id' | 'createdAt' | 'createdBy'>) => TimeOff
  updateTimeOff: (id: ID, patch: Partial<TimeOff>) => void
  removeTimeOff: (id: ID) => void

  scheduleRetouch: (jobId: ID, from?: Date) => void
  /** adaugă un eveniment în istoricul lucrării, semnat de utilizatorul curent */
  logEvent: (jobId: ID, kind: JobEventKind, label: string, detail?: string) => void
  /** mesajul „mașina e gata de ridicat” — intră în coada de notificări */
  schedulePickup: (jobId: ID, opts?: { message?: string; channel?: NotificationChannel }) => void
  /** retuș făcut: se anulează mesajele de retuș încă netrimise */
  markRetouchDone: (jobId: ID) => void
  scheduleDetailingFollowUp: (jobId: ID) => void
  markNotificationSent: (id: ID) => void
  cancelNotification: (id: ID) => void
  addNotification: (n: Omit<Notification, 'id'>) => void
}

export type Store = DB & { toasts: Toast[] } & Actions

const STATUS_LABEL: Record<JobStatus, string> = {
  programat: 'Programat',
  in_lucru: 'În lucru',
  blocat: 'Blocat',
  finalizat: 'Finalizat',
  predat: 'Predat',
  anulat: 'Anulat',
}

export const statusLabel = (s: JobStatus) => STATUS_LABEL[s]

export const STATUS_FLOW: JobStatus[] = [
  'programat',
  'in_lucru',
  'blocat',
  'finalizat',
  'predat',
]

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** cine e logat — semnează evenimentele din istoric */
      const who = () => get().staff.find((x) => x.id === get().currentUserId)?.name ?? CURRENT_USER
      const ev = (label: string, kind: JobEventKind, detail?: string): JobEvent => ({
        id: uid(),
        at: new Date().toISOString(),
        label,
        by: who(),
        kind,
        ...(detail ? { detail } : {}),
      })
      return {
      ...buildSeed(),
      toasts: [],

      reset: () => set({ ...buildSeed(), toasts: [] }),

      toast: (text, tone = 'ok') => {
        const t: Toast = { id: uid(), text, tone }
        set((s) => ({ toasts: [...s.toasts, t] }))
        setTimeout(() => get().dismissToast(t.id), 3500)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      addClient: (c) => {
        const client: Client = { ...c, id: uid(), createdAt: new Date().toISOString() }
        set((s) => ({ clients: [client, ...s.clients] }))
        return client
      },
      updateClient: (id, patch) =>
        set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      archiveClient: (id) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, archivedAt: new Date().toISOString() } : c,
          ),
        })),
      restoreClient: (id) =>
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, archivedAt: null } : c)),
        })),

      addCar: (c) => {
        const car: Car = { ...c, id: uid(), createdAt: new Date().toISOString() }
        set((s) => ({ cars: [car, ...s.cars] }))
        return car
      },
      updateCar: (id, patch) =>
        set((s) => ({ cars: s.cars.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCar: (id) =>
        set((s) => ({
          cars: s.cars.filter((c) => c.id !== id),
          jobs: s.jobs.filter((j) => j.carId !== id),
        })),

      addJob: (j) => {
        const nums = get()
          .jobs.map((x) => Number(x.code.replace(/\D/g, '')))
          .filter((n) => !Number.isNaN(n))
        const next = (nums.length ? Math.max(...nums) : 2030) + 1
        const estimateMin =
          j.estimateMin ??
          estimateRounded(
            j.services.map((s) => s.kind),
            get().settings,
            get().cars.find((c) => c.id === j.carId)?.bodyType,
          )
        // null = execuția se planifică mai târziu (după primire); doar câmpul lipsă primește implicit primirea
        const workStartAt = j.workStartAt === undefined ? j.startAt : j.workStartAt
        const workEndAt = workStartAt
          ? (j.workEndAt ?? new Date(new Date(workStartAt).getTime() + estimateMin * 60_000).toISOString())
          : null
        const job: Job = {
          ...j,
          estimateMin,
          estimateManual: j.estimateManual ?? false,
          workStartAt,
          workEndAt,
          actualStartAt: null,
          actualEndAt: null,
          id: uid(),
          code: `PRG-${next}`,
          createdAt: new Date().toISOString(),
          completedAt: null,
          trackingToken: uid().slice(0, 10),
          events: [
            ev(
              'Programare creată',
              'create',
              `${j.services.map((x) => serviceLabel(x)).join(' + ')} · primire ${fmtDateTime(j.startAt)}`,
            ),
          ],
        }
        set((s) => ({ jobs: [job, ...s.jobs] }))
        return job
      },
      updateJob: (id, patch) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
      removeJob: (id) =>
        set((s) => ({
          jobs: s.jobs.filter((j) => j.id !== id),
          notifications: s.notifications.filter((n) => n.jobId !== id),
        })),

      setJobStatus: (id, status) => {
        const job = get().jobs.find((j) => j.id === id)
        if (!job) return
        const now = new Date().toISOString()
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status,
                  completedAt: status === 'finalizat' || status === 'predat' ? j.completedAt ?? now : null,
                  handedOverAt: status === 'predat' ? j.handedOverAt ?? now : null,
                  events: [
                    ...j.events,
                    ev(
                      `Status → ${STATUS_LABEL[status]}`,
                      'status',
                      status === 'blocat' ? job.blockedReason : undefined,
                    ),
                  ],
                }
              : j,
          ),
        }))
        if (status === 'finalizat') {
          get().consumeCeramics(id)
          if (get().settings.pickupNotifyAuto) get().schedulePickup(id)
          get().scheduleDetailingFollowUp(id)
        }
        // oferta: retușul pornește după ce clientul a ridicat mașina
        if (status === 'predat') get().scheduleRetouch(id)
      },

      addJobPhoto: (id, photo) =>
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== id) return j
            const last = j.events[j.events.length - 1]
            const label = photo.serviceId ? 'Poze adăugate la serviciu' : 'Poze adăugate la primire'
            const recent =
              last?.kind === 'photo' && last.label === label && Date.now() - Date.parse(last.at) < 10 * 60_000
            const count = recent ? Number(last.detail?.match(/\d+/)?.[0] ?? 1) + 1 : 1
            const event = { ...(recent ? last : ev(label, 'photo')), detail: `${count} ${count === 1 ? 'poză' : 'poze'}` }
            return {
              ...j,
              photos: [...j.photos, photo],
              events: recent ? [...j.events.slice(0, -1), event] : [...j.events, event],
            }
          }),
        })),
      removeJobPhoto: (jobId, photoId) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId ? { ...j, photos: j.photos.filter((p) => p.id !== photoId) } : j,
          ),
        })),
      completeService: (jobId, serviceId, { note, photos }) => {
        const now = new Date().toISOString()
        const job = get().jobs.find((j) => j.id === jobId)
        const svc = job?.services.find((x) => x.id === serviceId)
        if (!job || !svc) return
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id !== jobId
              ? j
              : {
                  ...j,
                  services: j.services.map((x) =>
                    x.id === serviceId ? { ...x, done: true, doneAt: now, doneNote: note } : x,
                  ),
                  photos: [...j.photos, ...photos],
                  events: [
                    ...j.events,
                    ev(
                      `Serviciu finalizat: ${serviceLabel(svc)}`,
                      'service',
                      [note, photos.length ? `${photos.length} poze pentru client` : ''].filter(Boolean).join(' · ') ||
                        undefined,
                    ),
                  ],
                },
          ),
        }))
        const left = get().jobs.find((j) => j.id === jobId)!.services.filter((x) => !x.done).length
        get().toast(
          left
            ? `${serviceLabel(svc)} finalizat — mai ${left === 1 ? 'e 1 serviciu' : `sunt ${left} servicii`}`
            : 'Toate serviciile sunt gata — poți trece lucrarea în „Finalizat”',
        )
      },
      reopenService: (jobId, serviceId) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id !== jobId
              ? j
              : {
                  ...j,
                  services: j.services.map((x) =>
                    x.id === serviceId ? { ...x, done: false, doneAt: null } : x,
                  ),
                },
          ),
        })),
      updateJobPhoto: (jobId, photoId, patch) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? { ...j, photos: j.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)) }
              : j,
          ),
        })),

      addStockItem: (i) => {
        const item: StockItem = { ...i, id: uid(), createdAt: new Date().toISOString() }
        set((s) => ({ stock: [item, ...s.stock] }))
        return item
      },
      updateStockItem: (id, patch) =>
        set((s) => ({ stock: s.stock.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeStockItem: (id) => set((s) => ({ stock: s.stock.filter((i) => i.id !== id) })),

      consumeCeramics: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId)
        if (!job) return
        const now = new Date().toISOString()
        const used: string[] = []
        const missing: string[] = []
        const services = job.services.map((svc) => {
          if (svc.kind !== 'ceramica') return svc
          const usages = [...svc.rollUsages]
          for (const u of ceramicUses(svc, get().stock)) {
            // deja scăzut la o finalizare anterioară (ex. redeschidere + refinalizare)
            if (u.item && usages.some((x) => x.stockItemId === u.item!.id && x.appliedAt)) continue
            if (!u.item) {
              missing.push(u.product)
              continue
            }
            get().adjustStock(u.item.id, -1, `Consum lucrare ${job.code}`, job.id)
            usages.push({ id: uid(), stockItemId: u.item.id, qty: 1, appliedAt: now })
            used.push(u.product)
          }
          return { ...svc, rollUsages: usages }
        })
        if (!used.length && !missing.length) return
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, services } : j)) }))
        if (used.length) {
          get().logEvent(jobId, 'stock', 'Ceramice scăzute din stoc', used.map((p) => `${p} −1 buc`).join(' · '))
          get().toast(`Ceramice scăzute din stoc: ${used.join(', ')}`, 'ok')
        }
        if (missing.length)
          get().toast(`Nu sunt în stoc (nu s-a scăzut nimic): ${missing.join(', ')}`, 'info')
      },

      adjustStock: (id, delta, reason, jobId = null) =>
        set((s) => ({
          stock: s.stock.map((i) =>
            i.id === id ? { ...i, qty: Math.max(0, Math.round((i.qty + delta) * 100) / 100) } : i,
          ),
          moves: [
            {
              id: uid(),
              stockItemId: id,
              delta,
              reason,
              jobId,
              at: new Date().toISOString(),
              by: CURRENT_USER,
            },
            ...s.moves,
          ],
        })),

      applyRollUsages: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId)
        if (!job) return 0
        let applied = 0
        const lines: string[] = []
        job.services.forEach((svc) => {
          svc.rollUsages.forEach((u) => {
            if (u.appliedAt || !u.stockItemId || u.qty <= 0) return
            const it = get().stock.find((x) => x.id === u.stockItemId)
            if (it) lines.push(`${it.name} #${it.rollNumber} −${u.qty} ${it.unit}`)
            get().adjustStock(u.stockItemId, -u.qty, `Consum lucrare ${job.code}`, job.id)
            applied++
          })
        })
        if (!applied) return 0
        get().logEvent(jobId, 'stock', 'Consum folie scăzut din stoc', lines.join(' · '))
        const now = new Date().toISOString()
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id !== jobId
              ? j
              : {
                  ...j,
                  services: j.services.map((svc) => ({
                    ...svc,
                    rollUsages: svc.rollUsages.map((u) =>
                      u.appliedAt || !u.stockItemId || u.qty <= 0 ? u : { ...u, appliedAt: now },
                    ),
                  })),
                },
          ),
        }))
        return applied
      },

      markReceived: (id) => {
        const now = new Date().toISOString()
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id && !j.receivedAt
              ? {
                  ...j,
                  receivedAt: now,
                  events: [
                    ...j.events,
                    ev('Mașină primită în atelier', 'reception', `programată pentru ${fmtDateTime(j.startAt)}`),
                  ],
                }
              : j,
          ),
        }))
      },

      startExecution: (id) => {
        const now = new Date().toISOString()
        const job = get().jobs.find((j) => j.id === id)
        if (!job) return
        // execuția nu poate începe fără mașină: dacă primirea n-a fost confirmată, o confirmăm acum
        if (!jobReceivedAt(job)) get().markReceived(id)
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  actualStartAt: j.actualStartAt ?? now,
                  /** dacă execuția nu era planificată, o ancorăm acum */
                  workStartAt: j.workStartAt ?? now,
                  events: [
                    ...j.events,
                    ev(
                      'Execuție începută',
                      'work',
                      j.workStartAt ? `planificată pentru ${fmtDateTime(j.workStartAt)}` : undefined,
                    ),
                  ],
                }
              : j,
          ),
        }))
        get().setJobStatus(id, 'in_lucru')
      },

      finishExecution: (id) => {
        const now = new Date().toISOString()
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  actualEndAt: now,
                  workEndAt: j.workEndAt ?? now,
                  events: [
                    ...j.events,
                    ev(
                      'Execuție finalizată',
                      'work',
                      j.actualStartAt
                        ? `efectiv ${((Date.parse(now) - Date.parse(j.actualStartAt)) / 3_600_000).toFixed(1)} h · estimat ${(j.estimateMin / 60).toFixed(1)} h`
                        : undefined,
                    ),
                  ],
                }
              : j,
          ),
        }))
      },

      setCurrentUser: (id) => set({ currentUserId: id }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addTimeOff: (t) => {
        const me = get().staff.find((s) => s.id === get().currentUserId)
        const entry: TimeOff = {
          ...t,
          id: uid(),
          createdAt: new Date().toISOString(),
          createdBy: me?.name ?? CURRENT_USER,
        }
        set((s) => ({ timeOff: [entry, ...s.timeOff] }))
        return entry
      },
      updateTimeOff: (id, patch) =>
        set((s) => ({ timeOff: s.timeOff.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTimeOff: (id) => set((s) => ({ timeOff: s.timeOff.filter((t) => t.id !== id) })),

      /**
       * Oferta: a doua zi după ridicare pleacă „Te așteptăm la retuș în decurs de 7 zile”;
       * dacă retușul nu e marcat făcut, la 3 zile după cele 7 pleacă reminderul.
       */
      scheduleRetouch: (jobId, from = new Date()) => {
        const job = get().jobs.find((j) => j.id === jobId)
        if (!job) return
        const needsRetouch = job.services.some((s: ServiceEntry) => serviceDef(s.kind).retouch)
        if (!needsRetouch) return
        const already = get().notifications.some(
          (n) => n.jobId === jobId && n.kind === 'retus_7z' && n.status !== 'anulata',
        )
        if (already || job.retouchDoneAt) return

        const at10 = (d: Date) => setHours(startOfDay(d), 10)
        const first = at10(addDays(from, 1))
        const second = at10(addDays(addBusinessDays(from, 7), 3))
        const mk = (kind: Notification['kind'], dueAt: Date, message: string): Notification => ({
          id: uid(),
          jobId,
          clientId: job.clientId,
          kind,
          channel: 'sms',
          dueAt: dueAt.toISOString(),
          status: 'programata',
          message,
          sentAt: null,
        })
        set((s) => ({
          notifications: [
            mk(
              'retus_7z',
              first,
              `Custom Tuning: Te așteptăm la retuș în decurs de 7 zile pentru lucrarea ${job.code}. Sună-ne pentru o oră care ți se potrivește.`,
            ),
            mk(
              'retus_reminder_3z',
              second,
              `Custom Tuning: Ai uitat de retuș? Te așteptăm la retuș pentru oferirea garanției lucrării ${job.code}.`,
            ),
            ...s.notifications,
          ],
        }))
        get().logEvent(
          jobId,
          'retouch',
          'Retuș programat',
          `SMS invitație pe ${fmtDate(first.toISOString())} · reminder pe ${fmtDate(second.toISOString())} dacă nu vine`,
        )
        get().toast('Retuș programat: SMS mâine + reminder dacă nu vine în 7 zile', 'info')
      },

      schedulePickup: (jobId, opts = {}) => {
        const job = get().jobs.find((j) => j.id === jobId)
        if (!job) return
        const already = get().notifications.some(
          (n) => n.jobId === jobId && n.kind === 'ridicare' && n.status !== 'anulata',
        )
        if (already) return
        const car = get().cars.find((c) => c.id === job.carId)
        set((s) => ({
          notifications: [
            {
              id: uid(),
              jobId,
              clientId: job.clientId,
              kind: 'ridicare',
              channel: opts.channel ?? 'sms',
              dueAt: new Date().toISOString(),
              status: 'programata',
              message: opts.message ?? pickupMessage(job, car),
              sentAt: null,
            },
            ...s.notifications,
          ],
        }))
        get().logEvent(
          jobId,
          'notify',
          'Client anunțat: mașina e gata de ridicat',
          `${(opts.channel ?? 'sms').toUpperCase()} · „${opts.message ?? pickupMessage(job, car)}”`,
        )
        get().toast('Clientul va fi anunțat că poate ridica mașina', 'info')
      },

      markRetouchDone: (jobId) => {
        const now = new Date().toISOString()
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  retouchDoneAt: now,
                  events: [...j.events, ev('Retuș efectuat', 'retouch', 'mesajele de retuș netrimise au fost anulate')],
                }
              : j,
          ),
          notifications: s.notifications.map((n) =>
            n.jobId === jobId &&
            n.status === 'programata' &&
            (n.kind === 'retus_7z' || n.kind === 'retus_reminder_3z')
              ? { ...n, status: 'anulata' }
              : n,
          ),
        }))
        get().toast('Retuș marcat efectuat — reminderul a fost anulat')
      },

      /**
       * Follow-up comercial: la 6 luni după un detailing (interior sau exterior) clientul
       * primește o invitație cu 10% reducere — umple locurile libere din calendar.
       */
      scheduleDetailingFollowUp: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId)
        if (!job) return
        const hasDetailing = job.services.some(
          (s) =>
            s.kind === 'detailing' &&
            (s.values.interior === 'Da' || (s.values.exterior && s.values.exterior !== 'Nu')),
        )
        if (!hasDetailing) return
        const already = get().notifications.some(
          (n) => n.jobId === jobId && n.kind === 'detailing_6l' && n.status !== 'anulata',
        )
        if (already) return

        set((s) => ({
          notifications: [
            {
              id: uid(),
              jobId,
              clientId: job.clientId,
              kind: 'detailing_6l' as const,
              channel: 'whatsapp' as const,
              dueAt: addMonths(new Date(), 6).toISOString(),
              status: 'programata' as const,
              message: `Custom Tuning: au trecut 6 luni de la detailingul mașinii tale (${job.code}). Te invităm la o nouă ședință de detailing cu 10% reducere, în limita locurilor libere din calendar. Programează-te la 0722 000 000!`,
              sentAt: null,
            },
            ...s.notifications,
          ],
        }))
        get().toast('Invitație detailing programată la 6 luni (−10%)', 'info')
      },

      markNotificationSent: (id) => {
        const n = get().notifications.find((x) => x.id === id)
        set((s) => ({
          notifications: s.notifications.map((x) =>
            x.id === id ? { ...x, status: 'trimisa', sentAt: new Date().toISOString() } : x,
          ),
        }))
        if (n) get().logEvent(n.jobId, 'notify', `Mesaj trimis: ${NOTIF_KIND_LABEL[n.kind]}`, n.channel.toUpperCase())
      },
      cancelNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, status: 'anulata' } : n,
          ),
        })),
      addNotification: (n) =>
        set((s) => ({ notifications: [{ ...n, id: uid() }, ...s.notifications] })),

      logEvent: (jobId, kind, label, detail) =>
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === jobId ? { ...j, events: [...j.events, ev(label, kind, detail)] } : j)),
        })),
      }
    },
    {
      name: 'custom-tuning-mvp',
      version: 10,
      partialize: ({
        clients,
        cars,
        jobs,
        stock,
        moves,
        notifications,
        staff,
        timeOff,
        settings,
        currentUserId,
      }) => ({
        clients,
        cars,
        jobs,
        stock,
        moves,
        notifications,
        staff,
        timeOff,
        settings,
        currentUserId,
      }),
      /** Schema s-a schimbat de mai multe ori în MVP — pornim de la seed curat sub v5.
       *  v5 → v6: setările primesc durate de manoperă + factori pe tip de mașină.
       *  v6 → v7: setarea de anunțare la ridicare (câmpurile noi de pe lucrare sunt opționale).
       *  v7 → v8: „Așteaptă piese” devine „Blocat” (cu motiv).
       *  v8 → v9: stoc pe role individuale — se reîncarcă datele demo. */
      migrate: (persisted, version) => {
        // v9: stocul se ține pe role individuale de 15 m — datele demo vechi nu se pot converti
        // v10: istoric demo pe 12 luni pentru rapoarte — se reîncarcă datele demo
        if (version < 10) return buildSeed()
        const p = persisted as Store
        return { ...p, settings: { ...defaultSettings(), ...p.settings } }
      },
    },
  ),
)

// ---- selectors ----
export const useClient = (id?: ID) => useStore((s) => s.clients.find((c) => c.id === id))
export const useCar = (id?: ID) => useStore((s) => s.cars.find((c) => c.id === id))
export const useJob = (id?: ID) => useStore((s) => s.jobs.find((j) => j.id === id))

export const clientName = (c?: Client) =>
  !c ? '—' : c.type === 'pj' && c.companyName ? c.companyName : `${c.lastName} ${c.firstName}`.trim()

/** Clienții activi — cei arhivați nu apar în liste, căutare și selecții. */
export const activeClients = (cs: Client[]) => cs.filter((c) => !c.archivedAt)

export const carName = (c?: Car) => (!c ? '—' : `${c.make} ${c.model}`)

/**
 * Când a ajuns mașina în atelier. Lucrările vechi (fără câmp) care au trecut deja de
 * „Programat” sunt considerate primite la ora programată / la începerea execuției.
 */
export const jobReceivedAt = (j: Job): string | null =>
  j.receivedAt ??
  (j.status === 'programat' || j.status === 'anulat' ? null : (j.actualStartAt ?? j.startAt))

/** Textul implicit al mesajului „mașina e gata de ridicat”. */
export const pickupMessage = (job: Job, car?: Car) =>
  `Custom Tuning: lucrarea ${job.code} este gata! ${car ? `${car.make} ${car.model} (${car.plate})` : 'Mașina ta'} te așteaptă în atelier, L–V 09:00–18:00.`

/** Etichetele tipurilor de notificare — aceleași în fișa lucrării, Notificări și Dashboard. */
export const NOTIF_KIND_LABEL: Record<NotificationKind, string> = {
  ridicare: 'Mașina e gata de ridicat',
  retus_7z: 'Invitație retuș · a doua zi după predare',
  retus_reminder_3z: 'Reminder retuș · la 3 zile după cele 7',
  detailing_6l: 'Invitație detailing · 6 luni · −10%',
  custom: 'Notificare',
}

export const jobTotal = (j: Job) => j.services.reduce((sum, s) => sum + (s.price || 0), 0)

/* ---------- bani & TVA ---------- */

export const useSettings = () => useStore((s) => s.settings)

/** Doar owner/manager pot schimba regimul de TVA și datele firmei. */
export const canEditSettings = (role?: Role) => role === 'owner' || role === 'manager'

/* ---------- roluri & concedii ---------- */

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  operator: 'Operator',
}

/** Concediile sunt vizibile doar pentru owner și manager. */
export const canSeeTimeOff = (role?: Role) => role === 'owner' || role === 'manager'

export const useCurrentUser = () =>
  useStore((s) => s.staff.find((m) => m.id === s.currentUserId) ?? s.staff[0])

export const TIME_OFF_LABEL: Record<TimeOffType, string> = {
  concediu: 'Concediu de odihnă',
  liber: 'Zi liberă',
  medical: 'Concediu medical',
  training: 'Training / deplasare',
  inchis: 'Atelier închis',
}

export const TIME_OFF_COLOR: Record<TimeOffType, string> = {
  concediu: '#5b8def',
  liber: '#7d8189',
  medical: '#b05cd6',
  training: '#3ecf8e',
  inchis: '#e02a2a',
}

/** yyyy-MM-dd cade în intervalul (inclusiv)? */
export const timeOffCoversDay = (t: TimeOff, dayKey: string) =>
  dayKey >= t.startDate && dayKey <= t.endDate

/* ---------- sold de concediu ---------- */

export interface LeaveBalance {
  /** zile la care are dreptul în anul curent (pro-rata în anul angajării) */
  entitled: number
  /** zile lucrătoare deja consumate (concediu aprobat, încheiat sau în curs) */
  taken: number
  /** zile aprobate care urmează */
  planned: number
  /** cereri neaprobate */
  pending: number
  /** entitled − taken − planned */
  remaining: number
  /** vechime în ani, la zi */
  tenureYears: number
}

/**
 * Regula: 21 zile lucrătoare/an (configurabil per persoană). În anul angajării dreptul e
 * proporțional cu perioada lucrată, ca în Codul Muncii. Doar „concediu de odihnă” scade
 * din sold — medicalul, training-ul și zilele libere se urmăresc separat.
 */
export const leaveBalance = (
  person: StaffMember,
  timeOff: TimeOff[],
  today = new Date(),
): LeaveBalance => {
  const year = today.getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const todayKey = today.toISOString().slice(0, 10)

  const hire = person.hireDate || yearStart
  const hiredThisYear = hire > yearStart
  const daysInYear = differenceInCalendarDays(parseISO(yearEnd), parseISO(yearStart)) + 1
  const workedDays = differenceInCalendarDays(parseISO(yearEnd), parseISO(hire > yearStart ? hire : yearStart)) + 1
  const annual = person.annualLeaveDays || 21
  const entitled = hiredThisYear
    ? Math.max(0, Math.round((annual * workedDays) / daysInYear))
    : annual

  const mine = timeOff.filter(
    (t) => t.staffId === person.id && t.type === 'concediu' && t.endDate >= yearStart && t.startDate <= yearEnd,
  )
  const days = (t: TimeOff) =>
    businessDaysBetween(t.startDate < yearStart ? yearStart : t.startDate, t.endDate > yearEnd ? yearEnd : t.endDate)

  const taken = mine.filter((t) => t.approved && t.startDate <= todayKey).reduce((s, t) => s + days(t), 0)
  const planned = mine.filter((t) => t.approved && t.startDate > todayKey).reduce((s, t) => s + days(t), 0)
  const pending = mine.filter((t) => !t.approved).reduce((s, t) => s + days(t), 0)

  return {
    entitled,
    taken,
    planned,
    pending,
    remaining: entitled - taken - planned,
    tenureYears: person.hireDate
      ? differenceInCalendarDays(today, parseISO(person.hireDate)) / 365.25
      : 0,
  }
}
