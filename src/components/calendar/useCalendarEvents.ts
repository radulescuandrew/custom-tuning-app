import { useMemo } from 'react'
import { addMinutes } from 'date-fns'
import type { Job, JobStatus } from '@/data/types'
import {
  TIME_OFF_COLOR,
  TIME_OFF_LABEL,
  canSeeTimeOff,
  carName,
  clientName,
  useCurrentUser,
  useStore,
} from '@/data/store'
import { serviceDef } from '@/data/serviceCatalog'
import { STATUS_TONE } from '@/components/StatusBadge'

export const TONE_HEX: Record<string, string> = {
  brand: '#d51f1f',
  mint: '#0f8f5d',
  ember: '#b8620f',
  sky: '#5a6472',
  rose: '#c22f49',
  neutral: '#6b6b76',
}

export type CalEventKind = 'primire' | 'executie' | 'timeoff'
export type Layer = 'primire' | 'executie' | 'concedii'

export interface CalEvent {
  /** unic în calendar: jobId, `${jobId}::work` sau `off-${id}` */
  id: string
  jobId: string | null
  /** codul lucrării, PRG-…; gol pentru concedii */
  code: string
  kind: CalEventKind
  title: string
  start: Date
  end: Date
  allDay: boolean
  color: string
  client: string
  plate: string
  services: string
  assignee: string
  status: JobStatus | null
  editable: boolean
}

/** Ce are nevoie constructorul de evenimente. Filtrele de status și căutarea taie `jobs` înainte. */
export interface CalFilters {
  layers: Layer[]
  who: string
}

/**
 * Sursa unică a celor trei straturi de calendar — primire, execuție, concedii.
 * O consumă și FullCalendar (desktop, prin `fullCalendarAdapter`), și calendarul de telefon.
 */
export function useCalendarEvents(jobs: Job[], filters: CalFilters): CalEvent[] {
  const clients = useStore((s) => s.clients)
  const cars = useStore((s) => s.cars)
  const staff = useStore((s) => s.staff)
  const timeOff = useStore((s) => s.timeOff)
  const me = useCurrentUser()
  const showTimeOff = canSeeTimeOff(me?.role)

  const { layers, who } = filters

  return useMemo(() => {
    const out: CalEvent[] = []
    const visible = who === 'toti' ? jobs : jobs.filter((j) => j.assignee === who)

    visible.forEach((j) => {
      const car = cars.find((c) => c.id === j.carId)
      const client = clients.find((c) => c.id === j.clientId)
      const color = TONE_HEX[STATUS_TONE[j.status]] ?? TONE_HEX.neutral
      const common = {
        jobId: j.id,
        code: j.code,
        title: carName(car),
        color,
        client: clientName(client),
        plate: car?.plate ?? '',
        services: j.services.map((s) => serviceDef(s.kind).short).join(' · '),
        assignee: j.assignee,
        status: j.status,
        allDay: false,
        editable: true,
      }

      /** 1. Primirea mașinii — slot scurt, în ziua programării. */
      if (layers.includes('primire')) {
        const start = new Date(j.startAt)
        out.push({
          ...common,
          id: j.id,
          kind: 'primire',
          start,
          end: addMinutes(start, j.durationMin || 30),
        })
      }

      /** 2. Execuția planificată — poate fi în altă zi decât primirea. */
      if (layers.includes('executie') && j.workStartAt) {
        const start = new Date(j.workStartAt)
        out.push({
          ...common,
          id: `${j.id}::work`,
          kind: 'executie',
          start,
          end: j.workEndAt ? new Date(j.workEndAt) : addMinutes(start, j.estimateMin || 60),
        })
      }
    })

    if (!showTimeOff || !layers.includes('concedii')) return out

    /** 3. Concedii — doar owner/manager, la cerere, niciodată editabile. */
    timeOff.forEach((t) => {
      const person = staff.find((s) => s.id === t.staffId)
      const end = new Date(t.endDate)
      end.setDate(end.getDate() + 1) // FullCalendar: end exclusiv
      out.push({
        id: `off-${t.id}`,
        jobId: null,
        code: '',
        kind: 'timeoff',
        title:
          t.type === 'inchis'
            ? 'ATELIER ÎNCHIS'
            : `${person?.name ?? '—'} · ${TIME_OFF_LABEL[t.type]}${t.approved ? '' : ' (neaprobat)'}`,
        start: new Date(t.startDate),
        end,
        allDay: true,
        color: TIME_OFF_COLOR[t.type],
        client: '',
        plate: '',
        services: '',
        assignee: person?.name ?? '',
        status: null,
        editable: false,
      })
    })
    return out
  }, [jobs, cars, clients, staff, timeOff, showTimeOff, layers, who])
}
