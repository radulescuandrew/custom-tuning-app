import type { JobStatus } from '@/data/types'
import { statusLabel } from '@/data/store'
import { Badge, type Tone } from './ui'

export const STATUS_TONE: Record<JobStatus, Tone> = {
  programat: 'sky',
  in_lucru: 'gold',
  blocat: 'ember',
  finalizat: 'mint',
  predat: 'neutral',
  anulat: 'rose',
}

export const StatusBadge = ({ status }: { status: JobStatus }) => (
  <Badge tone={STATUS_TONE[status]}>{statusLabel(status)}</Badge>
)
