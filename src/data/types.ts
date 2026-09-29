export type ID = string

export type ClientType = 'pf' | 'pj'

export interface Client {
  id: ID
  type: ClientType
  firstName: string
  lastName: string
  phone: string
  email: string
  cnp: string
  address: string
  companyName: string
  vatId: string // RO-ul firmei / CUI
  notes: string
  createdAt: string
}

/** Tip caroserie — folosit la estimarea manoperei (SUV durează mai mult decât o compactă). */
export type CarBodyType = 'compacta' | 'sedan' | 'break' | 'coupe_sport' | 'suv' | 'suv_mare'

export interface Car {
  id: ID
  clientId: ID
  make: string
  model: string
  /** gol = necompletat, se folosește factorul 1 la estimări */
  bodyType?: CarBodyType | ''
  year: number | null
  engine: string
  plate: string
  vin: string
  chassis: string
  color: string
  notes: string
  createdAt: string
}

export type JobStatus =
  | 'programat'
  | 'in_lucru'
  | 'asteapta_piese'
  | 'finalizat'
  | 'predat'
  | 'anulat'

export type ServiceKind =
  | 'colantare'
  | 'folie_geam'
  | 'folie_parbriz'
  | 'jante'
  | 'tuning'
  | 'suspensii'
  | 'evacuare'
  | 'chip_tuning'
  | 'detailing'
  | 'ceramica'

/** Element de caroserie (bara fata, praguri, ...) folosit la colantare & tuning. */
export interface ElementEntry {
  id: ID
  name: string
  checked: boolean
  /** cod produs / cod folie — spec: "la fiecare element sa putem trece codul produsului" */
  code: string
  note: string
}

/** Valorile unei fise de serviciu. Cheile vin din catalogul de servicii. */
export interface ServiceEntry {
  id: ID
  kind: ServiceKind
  /** valori simple pentru campurile definite in catalog */
  values: Record<string, string>
  /** elemente bifate, doar la serviciile cu elements: true */
  elements: ElementEntry[]
  /** role consumate din stoc (colantare) */
  rollUsages: RollUsage[]
  price: number
  done: boolean
}

export interface RollUsage {
  id: ID
  stockItemId: ID
  /** metri (folie) sau bucati */
  qty: number
  appliedAt: string | null
}

export interface JobPhoto {
  id: ID
  /** cheia din IndexedDB unde sta blob-ul */
  key: string
  name: string
  caption: string
  createdAt: string
}

export interface JobEvent {
  id: ID
  at: string
  label: string
  by: string
}

export interface Job {
  id: ID
  code: string // PRG-2041
  clientId: ID
  carId: ID
  status: JobStatus

  /** PROGRAMARE = momentul în care clientul aduce mașina (slot de primire). */
  startAt: string
  /** durata slotului de primire, în minute (default 30) */
  durationMin: number

  /** EXECUȚIE PLANIFICATĂ — poate începe în aceeași zi sau mai târziu. */
  workStartAt: string | null
  workEndAt: string | null
  /** estimare manoperă în minute (sugerată din servicii, editabilă) */
  estimateMin: number
  /** true dacă operatorul a suprascris estimarea automată */
  estimateManual: boolean

  /** EXECUȚIE REALĂ — completată de butoanele Începe / Finalizează. */
  actualStartAt: string | null
  actualEndAt: string | null

  /** data estimata de predare a masinii catre client */
  deliveryAt: string | null
  assignee: string
  notes: string // "rubrica mentiuni"
  services: ServiceEntry[]
  photos: JobPhoto[]
  events: JobEvent[]
  /** token pentru pagina publica de tracking */
  trackingToken: string
  createdAt: string
  completedAt: string | null
}

export type StockCategory =
  | 'ppf'
  | 'folie_color'
  | 'folie_geam'
  | 'ceramica'
  | 'consumabile'

export interface StockItem {
  id: ID
  category: StockCategory
  maker: string
  name: string
  /** numarul rolei / lotului — spec: "sa bifeze rola din care au folosit si sa ia numarul ei automat" */
  rollNumber: string
  finish: 'lucioasa' | 'mata' | '' // transparenta lucioasa / mata
  width: string // 1.52 / 1.82 m
  /** unitate: m pentru folie, buc pentru ceramica */
  unit: 'm' | 'buc'
  qty: number
  minQty: number
  location: string
  createdAt: string
}

export interface StockMove {
  id: ID
  stockItemId: ID
  delta: number
  reason: string
  jobId: ID | null
  at: string
  by: string
}

export type NotificationKind =
  | 'retus_7z'
  | 'retus_reminder_3z'
  | 'detailing_6l'
  | 'ridicare'
  | 'custom'
export type NotificationChannel = 'sms' | 'email' | 'whatsapp'
export type NotificationStatus = 'programata' | 'trimisa' | 'anulata'

export interface Notification {
  id: ID
  jobId: ID
  clientId: ID
  kind: NotificationKind
  channel: NotificationChannel
  /** cand trebuie trimisa */
  dueAt: string
  status: NotificationStatus
  message: string
  sentAt: string | null
}

/* ---------- echipă, roluri, concedii ---------- */

export type Role = 'owner' | 'manager' | 'operator'

export interface StaffMember {
  id: ID
  name: string
  role: Role
  /** culoare pentru calendar */
  color: string
  active: boolean
  /** yyyy-MM-dd — din ea se calculează dreptul de concediu pe anul angajării (pro-rata) */
  hireDate: string
  /** zile de concediu de odihnă pe an (legal minim 20, uzual 21) */
  annualLeaveDays: number
  /** funcția din atelier, pentru filtrarea echipei */
  position: string
}

export type TimeOffType = 'concediu' | 'liber' | 'medical' | 'training' | 'inchis'

export interface TimeOff {
  id: ID
  staffId: ID
  type: TimeOffType
  /** yyyy-MM-dd, inclusiv ambele capete */
  startDate: string
  endDate: string
  note: string
  approved: boolean
  createdAt: string
  createdBy: string
}

/* ---------- setări firmă (monedă & TVA) ---------- */

export interface Settings {
  companyName: string
  /** RO / CUI-ul atelierului — apare pe fișa PDF */
  vatId: string
  /** firmă plătitoare de TVA? dacă nu, nu se afișează nicio linie de TVA */
  vatPayer: boolean
  /** cota de TVA, în procente (21% în România de la 1 august 2025) */
  vatRate: number
  /** prețurile din fișe sunt introduse cu TVA inclus (true) sau ca bază (false) */
  pricesIncludeVat: boolean
  /** durate de manoperă (minute) per serviciu — suprascriu valorile din catalog */
  serviceDurationMin: Partial<Record<ServiceKind, number>>
  /** factor de timp per tip de caroserie (SUV 1.25 = +25% față de bază) */
  carTypeFactor: Record<CarBodyType, number>
}

export interface DB {
  clients: Client[]
  cars: Car[]
  jobs: Job[]
  stock: StockItem[]
  moves: StockMove[]
  notifications: Notification[]
  staff: StaffMember[]
  timeOff: TimeOff[]
  settings: Settings
  /** cine e logat (demo — se schimbă din sidebar) */
  currentUserId: ID
}
