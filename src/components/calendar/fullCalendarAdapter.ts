import type { EventInput } from '@fullcalendar/core'
import type { CalEvent } from './useCalendarEvents'

/**
 * CalEvent → EventInput, exact formele pe care desktopul le randa înainte de extracție:
 * primirea albă cu bordură colorată, execuția cu fundal la 15% opacitate, concediile blocuri all-day.
 */
export function toFullCalendarEvents(events: CalEvent[]): EventInput[] {
  return events.map((e) => {
    const extendedProps = {
      kind: e.kind,
      color: e.color,
      code: e.code,
      plate: e.plate,
      client: e.client,
      services: e.services,
      assignee: e.assignee,
    }

    if (e.kind === 'timeoff')
      return {
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: true,
        display: 'block',
        backgroundColor: `${e.color}1a`,
        borderColor: e.color,
        textColor: e.color,
        editable: false,
        extendedProps,
      }

    return {
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      backgroundColor: e.kind === 'primire' ? '#ffffff' : `${e.color}26`,
      borderColor: e.color,
      textColor: '#16161b',
      classNames: [e.kind === 'primire' ? 'ct-ev-primire' : 'ct-ev-executie'],
      extendedProps,
    }
  })
}
