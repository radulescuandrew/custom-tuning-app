import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Car,
  Client,
  DB,
  ID,
  Job,
  JobPhoto,
  JobStatus,
  Notification,
  Role,
  ServiceEntry,
  Settings,
  StaffMember,
  StockItem,
  TimeOff,
  TimeOffType,
} from './types'
import { buildSeed, defaultSettings } from './seed'
import { estimateRounded, serviceDef } from './serviceCatalog'
import { addBusinessDays, businessDaysBetween, uid } from '@/lib/utils'
import { addDays, addMonths, differenceInCalendarDays, parseISO } from 'date-fns'

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
  removeClient: (id: ID) => void

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

  addStockItem: (s: Omit<StockItem, 'id' | 'createdAt'>) => StockItem
  updateStockItem: (id: ID, patch: Partial<StockItem>) => void
  removeStockItem: (id: ID) => void
  adjustStock: (id: ID, delta: number, reason: string, jobId?: ID | null) => void
  /** aplică toate consumurile de rolă neaplicate ale unei lucrări */
  applyRollUsages: (jobId: ID) => number

  /** pornește execuția: marchează ora reală de start și trece în „În lucru” */
  startExecution: (id: ID) => void
  /** oprește execuția: marchează ora reală de final și trece în „Finalizat” */
  finishExecution: (id: ID) => void

  setCurrentUser: (id: ID) => void
  updateSettings: (patch: Partial<Settings>) => void
  addTimeOff: (t: Omit<TimeOff, 'id' | 'createdAt' | 'createdBy'>) => TimeOff
  updateTimeOff: (id: ID, patch: Partial<TimeOff>) => void
  removeTimeOff: (id: ID) => void

  scheduleRetouch: (jobId: ID) => void
  scheduleDetailingFollowUp: (jobId: ID) => void
  markNotificationSent: (id: ID) => void
  cancelNotification: (id: ID) => void
  addNotification: (n: Omit<Notification, 'id'>) => void
}

export type Store = DB & { toasts: Toast[] } & Actions

const STATUS_LABEL: Record<JobStatus, string> = {
  programat: 'Programat',
  in_lucru: 'În lucru',
  asteapta_piese: 'Așteaptă piese',
  finalizat: 'Finalizat',
  predat: 'Predat',
  anulat: 'Anulat',
}

export const statusLabel = (s: JobStatus) => STATUS_LABEL[s]

export const STATUS_FLOW: JobStatus[] = [
  'programat',
  'in_lucru',
  'asteapta_piese',
  'finalizat',
  'predat',
]

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
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
      removeClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          cars: s.cars.filter((c) => c.clientId !== id),
          jobs: s.jobs.filter((j) => j.clientId !== id),
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
        const workStartAt = j.workStartAt ?? j.startAt
        const workEndAt =
          j.workEndAt ?? new Date(new Date(workStartAt).getTime() + estimateMin * 60_000).toISOString()
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
            { id: uid(), at: new Date().toISOString(), label: 'Programare creată', by: CURRENT_USER },
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
                  events: [
                    ...j.events,
                    { id: uid(), at: now, label: `Status → ${STATUS_LABEL[status]}`, by: CURRENT_USER },
                  ],
                }
              : j,
          ),
        }))
        if (status === 'finalizat') {
          get().scheduleRetouch(id)
          get().scheduleDetailingFollowUp(id)
        }
      },

      addJobPhoto: (id, photo) =>
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, photos: [...j.photos, photo] } : j)),
        })),
      removeJobPhoto: (jobId, photoId) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId ? { ...j, photos: j.photos.filter((p) => p.id !== photoId) } : j,
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
        job.services.forEach((svc) => {
          svc.rollUsages.forEach((u) => {
            if (u.appliedAt || !u.stockItemId || u.qty <= 0) return
            get().adjustStock(u.stockItemId, -u.qty, `Consum lucrare ${job.code}`, job.id)
            applied++
          })
        })
        if (!applied) return 0
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

      startExecution: (id) => {
        const now = new Date().toISOString()
        const job = get().jobs.find((j) => j.id === id)
        if (!job) return
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
                    { id: uid(), at: now, label: 'Execuție începută', by: CURRENT_USER },
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
                    { id: uid(), at: now, label: 'Execuție finalizată', by: CURRENT_USER },
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

      /** Spec: notificare SMS retuș la 7 zile lucrătoare + reminder după încă 3 zile. */
      scheduleRetouch: (jobId) => {
        const job = get().jobs.find((j) => j.id === jobId)
        if (!job) return
        const needsRetouch = job.services.some((s: ServiceEntry) => serviceDef(s.kind).retouch)
        if (!needsRetouch) return
        const already = get().notifications.some(
          (n) => n.jobId === jobId && n.kind === 'retus_7z' && n.status !== 'anulata',
        )
        if (already) return

        const base = new Date()
        const first = addBusinessDays(base, 7)
        const second = addDays(first, 3)
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
              `Custom Tuning: folia aplicată pe ${job.code} are nevoie de retuș. Te așteptăm în atelier în următoarele zile — 0722 000 000.`,
            ),
            mk(
              'retus_reminder_3z',
              second,
              `Custom Tuning: reamintire — retușul foliei este încă disponibil pentru ${job.code}. Te așteptăm!`,
            ),
            ...s.notifications,
          ],
        }))
        get().toast('Notificări retuș programate (7 zile lucrătoare + reminder)', 'info')
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

      markNotificationSent: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, status: 'trimisa', sentAt: new Date().toISOString() } : n,
          ),
        })),
      cancelNotification: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, status: 'anulata' } : n,
          ),
        })),
      addNotification: (n) =>
        set((s) => ({ notifications: [{ ...n, id: uid() }, ...s.notifications] })),
    }),
    {
      name: 'custom-tuning-mvp',
      version: 6,
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
       *  v5 → v6: setările primesc durate de manoperă + factori pe tip de mașină. */
      migrate: (persisted, version) => {
        if (version < 5) return buildSeed()
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

export const carName = (c?: Car) => (!c ? '—' : `${c.make} ${c.model}`)

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
