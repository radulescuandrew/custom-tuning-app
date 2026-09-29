import { addDays, setHours, setMinutes, startOfDay, subDays } from 'date-fns'
import type { DB, Job, JobStatus, ServiceEntry, ServiceKind, Settings } from './types'
import { BODY_ELEMENTS, CAR_TYPES, estimateRounded, serviceDef } from './serviceCatalog'
import { uid } from '@/lib/utils'

/** Setările implicite — folosite la seed și la migrarea datelor persistate mai vechi. */
export const defaultSettings = (): Settings => ({
  companyName: 'Custom Tuning SRL',
  vatId: 'RO12345678',
  vatPayer: true,
  /** cota standard în România de la 1 august 2025 */
  vatRate: 21,
  /** prețurile din fișe sunt cele finale, afișate clientului */
  pricesIncludeVat: true,
  /** gol = se folosesc duratele din catalogul de servicii */
  serviceDurationMin: {},
  carTypeFactor: Object.fromEntries(
    CAR_TYPES.map((c) => [c.value, c.defaultFactor]),
  ) as Settings['carTypeFactor'],
})

const iso = (d: Date) => d.toISOString()
const at = (dayOffset: number, hour: number, min = 0) =>
  iso(setMinutes(setHours(startOfDay(addDays(new Date(), dayOffset)), hour), min))

const els = (names: string[], code = '') =>
  BODY_ELEMENTS.map((name) => ({
    id: uid(),
    name,
    checked: names.includes(name),
    code: names.includes(name) ? code : '',
    note: '',
  }))

const svc = (
  kind: ServiceKind,
  values: Record<string, string>,
  opts: { elements?: string[]; price?: number; rolls?: { stockItemId: string; qty: number }[] } = {},
): ServiceEntry => ({
  id: uid(),
  kind,
  values,
  elements: opts.elements ? els(opts.elements) : [],
  rollUsages: (opts.rolls ?? []).map((r) => ({
    id: uid(),
    stockItemId: r.stockItemId,
    qty: r.qty,
    appliedAt: null,
  })),
  price: opts.price ?? serviceDef(kind).defaultPrice,
  done: false,
})

const C = {
  vlad: 'cl-vlad',
  ana: 'cl-ana',
  rares: 'cl-rares',
  tribus: 'cl-tribus',
  mihai: 'cl-mihai',
  elena: 'cl-elena',
}
const A = {
  m4: 'car-m4',
  golf: 'car-golf',
  amg: 'car-amg',
  rs6: 'car-rs6',
  q3: 'car-q3',
  tesla: 'car-tesla',
  supra: 'car-supra',
}
const S = {
  ppfGloss: 'st-ppf-gloss',
  ppfMatte: 'st-ppf-matte',
  ppf182: 'st-ppf-182',
  satinGrey: 'st-satin-grey',
  glossBlack: 'st-gloss-black',
  tint20: 'st-tint-20',
  krytex9h: 'st-krytex-9h',
  krytexRims: 'st-krytex-rims',
}

export const buildSeed = (): DB => {
  const jobs: Job[] = []

  const mk = (
    p: Partial<Job> & { clientId: string; carId: string; startAt: string; services: ServiceEntry[] },
  ): Job => {
    const n = 2030 + jobs.length
    const estimate = estimateRounded(p.services.map((s) => s.kind))
    const workStart = p.workStartAt ?? p.startAt
    const job: Job = {
      id: uid(),
      code: `PRG-${n}`,
      status: 'programat' as JobStatus,
      /** slot de primire: 30 min */
      durationMin: 30,
      workStartAt: workStart,
      workEndAt: new Date(new Date(workStart).getTime() + estimate * 60_000).toISOString(),
      estimateMin: estimate,
      estimateManual: false,
      actualStartAt: null,
      actualEndAt: null,
      deliveryAt: null,
      assignee: 'Andrei Pavel',
      notes: '',
      photos: [],
      events: [],
      trackingToken: uid().slice(0, 10),
      createdAt: iso(subDays(new Date(), 10)),
      completedAt: null,
      ...p,
    }
    jobs.push(job)
    return job
  }

  mk({
    clientId: C.vlad,
    carId: A.m4,
    startAt: at(0, 9),
    deliveryAt: at(3, 17),
    status: 'in_lucru',
    assignee: 'Andrei Pavel',
    actualStartAt: at(0, 9, 20),
    notes: 'Client cere atenție specială la pragurile deja zgâriate.',
    services: [
      svc(
        'colantare',
        {
          ppfMaker: 'SunTek',
          ppfFinish: 'Lucioasă',
          ppfRoll: S.ppfGloss,
          colorMaker: '',
          colorName: '',
          colorRoll: '',
          metersUsed: '20',
          crew: 'Andrei Pavel',
        },
        {
          elements: ['Bară față', 'Capotă', 'Aripi față', 'Praguri', 'Oglinzi', 'Bară spate'],
          rolls: [{ stockItemId: S.ppfGloss, qty: 20 }],
          price: 8900,
        },
      ),
      svc('ceramica', { 'Krytex 9H + Mega 8__used': 'Da', 'Krytex 9H + Mega 8__code': 'KX-99182' }, { price: 1250 }),
    ],
  })

  mk({
    clientId: C.ana,
    carId: A.golf,
    startAt: at(1, 8, 30),
    deliveryAt: at(1, 18),
    status: 'programat',
    assignee: 'Cosmin Dinu',
    services: [
      svc('detailing', { interior: 'Da', exterior: 'Doi pași', crew: 'Cosmin Dinu', obs: '' }, { price: 2400 }),
    ],
  })

  mk({
    clientId: C.tribus,
    carId: A.rs6,
    startAt: at(2, 10),
    workStartAt: at(5, 9),
    deliveryAt: at(6, 16),
    status: 'asteapta_piese',
    assignee: 'Andrei Pavel',
    notes: 'Difuzorul carbon vine pe 12, restul e în stoc.',
    services: [
      svc(
        'tuning',
        { partsMaker: 'ABT', material: 'Carbon' },
        { elements: ['Lip bară față', 'Diffuser', 'Eleron portbagaj'], price: 18500 },
      ),
      svc('evacuare', { maker: 'Akrapovič', code: 'S-AU/TI/8', valves: 'Da' }, { price: 14500 }),
    ],
  })

  mk({
    clientId: C.rares,
    carId: A.supra,
    startAt: at(3, 9),
    status: 'programat',
    assignee: 'Cosmin Dinu',
    services: [
      svc(
        'colantare',
        {
          ppfMaker: '',
          ppfFinish: '—',
          ppfRoll: '',
          colorMaker: 'Avery Dennison',
          colorName: 'Satin Dark Grey',
          colorRoll: S.satinGrey,
          metersUsed: '17',
          crew: 'Cosmin Dinu',
        },
        {
          elements: BODY_ELEMENTS.slice(0, 9),
          rolls: [{ stockItemId: S.satinGrey, qty: 17 }],
          price: 10500,
        },
      ),
    ],
  })

  mk({
    clientId: C.mihai,
    carId: A.q3,
    startAt: at(4, 11),
    status: 'programat',
    assignee: 'Andrei Pavel',
    services: [
      svc('jante', {
        maker: 'BBS',
        model: 'CH-R II',
        diameter: '20"',
        width: '9J',
        et: 'ET35',
        color: 'Satin Platinum',
        tyres: '255/35 R20',
      }),
    ],
  })

  mk({
    clientId: C.elena,
    carId: A.tesla,
    startAt: at(5, 9, 30),
    status: 'programat',
    assignee: 'Cosmin Dinu',
    services: [
      svc(
        'colantare',
        {
          ppfMaker: 'SunTek',
          ppfFinish: 'Mată',
          ppfRoll: S.ppfMatte,
          colorMaker: '',
          colorName: '',
          colorRoll: '',
          metersUsed: '12',
          crew: 'Cosmin Dinu',
        },
        { elements: ['Bară față', 'Capotă', 'Aripi față'], rolls: [{ stockItemId: S.ppfMatte, qty: 12 }], price: 5600 },
      ),
    ],
  })

  mk({
    clientId: C.vlad,
    carId: A.amg,
    startAt: at(8, 9),
    status: 'programat',
    assignee: 'Andrei Pavel',
    services: [
      svc('suspensii', {
        maker: 'KW',
        model: 'V3',
        code: '35225072',
        shockFL: 'KW-FL-8812',
        shockFR: 'KW-FR-8813',
        shockRL: 'KW-RL-8820',
        shockRR: 'KW-RR-8821',
        springMaker: 'KW',
        springCode: 'SP-V3-AMG',
        springFL: 'SP-FL-201',
        springFR: 'SP-FR-201',
        springRL: 'SP-RL-244',
        springRR: 'SP-RR-244',
        markerColor: 'Galben',
        torque: '',
      }),
    ],
  })


  // Zi aglomerată (mâine) — 6 primiri, ca să se vadă cum arată calendarul plin
  const busy: Array<[string, string, number, number, string, ServiceEntry[]]> = [
    [C.vlad, A.amg, 8, 0, 'Andrei Pavel', [svc('folie_geam', { maker: 'LLumar', vlt: '20%', roll: S.tint20, zones: 'Laterale spate + lunetă', metersUsed: '4' })]],
    [C.mihai, A.q3, 9, 0, 'Robert Ilie', [svc('chip_tuning', { ecu: 'Bosch MD1CS006', stage: 'Stage 1', tool: 'Autotuner', hpBefore: '150', hpAfter: '190', backup: 'Da' })]],
    [C.elena, A.tesla, 10, 30, 'Daniel Marin', [svc('folie_parbriz', { maker: 'STEK', code: 'DYNOshield', roll: S.ppf182, metersUsed: '2', warranty: '24' })]],
    [C.rares, A.supra, 12, 0, 'Cosmin Dinu', [svc('detailing', { interior: 'Nu', exterior: 'Un pas', crew: 'Cosmin Dinu', obs: '' }, { price: 1500 })]],
    [C.tribus, A.rs6, 14, 0, 'Andrei Pavel', [svc('jante', { maker: 'Vossen', model: 'HF-5', diameter: '21"', width: '10J', et: 'ET42', color: 'Gloss Graphite', tyres: '285/30 R21' })]],
    [C.ana, A.golf, 16, 0, 'Robert Ilie', [svc('ceramica', { 'Krytex Mega Rims__used': 'Da', 'Krytex Mega Rims__code': 'KX-77012' }, { price: 1900 })]],
  ]
  busy.forEach(([clientId, carId, h, m, who, services]) =>
    mk({ clientId, carId, startAt: at(1, h, m), assignee: who, status: 'programat', services }),
  )

  // Lucrări finalizate (istoric + retușuri de urmărit)
  const done1 = mk({
    clientId: C.ana,
    carId: A.golf,
    startAt: at(-9, 9),
    deliveryAt: at(-6, 17),
    status: 'predat',
    assignee: 'Andrei Pavel',
    completedAt: at(-6, 16),
    actualStartAt: at(-9, 9, 30),
    actualEndAt: at(-6, 15),
    services: [
      svc(
        'colantare',
        {
          ppfMaker: 'STEK',
          ppfFinish: 'Lucioasă',
          ppfRoll: S.ppf182,
          colorMaker: '',
          colorName: '',
          colorRoll: '',
          metersUsed: '9',
          crew: 'Andrei Pavel',
        },
        { elements: ['Bară față', 'Capotă'], rolls: [{ stockItemId: S.ppf182, qty: 9 }], price: 4800 },
      ),
    ],
  })

  const done2 = mk({
    clientId: C.mihai,
    carId: A.q3,
    startAt: at(-20, 9),
    deliveryAt: at(-17, 17),
    status: 'predat',
    assignee: 'Cosmin Dinu',
    completedAt: at(-17, 15),
    actualStartAt: at(-20, 10),
    actualEndAt: at(-17, 14),
    services: [
      svc('detailing', { interior: 'Da', exterior: 'Trei pași', crew: 'Cosmin Dinu', obs: '' }, { price: 4900 }),
      svc('ceramica', { 'Krytex Mega 8__used': 'Da', 'Krytex Mega 8__code': 'KX-88041' }, { price: 3200 }),
    ],
  })

  const clients: DB['clients'] = [
    {
      id: C.vlad,
      type: 'pf',
      firstName: 'Vlad',
      lastName: 'Ionescu',
      phone: '0722 145 220',
      email: 'vlad.ionescu@gmail.com',
      cnp: '1890412334455',
      address: 'Str. Aviatorilor 14, București',
      companyName: '',
      vatId: '',
      notes: 'Client fidel, 3 lucrări în ultimii 2 ani.',
      createdAt: iso(subDays(new Date(), 400)),
    },
    {
      id: C.ana,
      type: 'pf',
      firstName: 'Ana',
      lastName: 'Dobre',
      phone: '0733 908 112',
      email: 'ana.dobre@yahoo.com',
      cnp: '2940822112233',
      address: 'Bd. Unirii 33, București',
      companyName: '',
      vatId: '',
      notes: '',
      createdAt: iso(subDays(new Date(), 220)),
    },
    {
      id: C.rares,
      type: 'pf',
      firstName: 'Rareș',
      lastName: 'Marin',
      phone: '0745 221 009',
      email: 'rares.marin@gmail.com',
      cnp: '1970103998877',
      address: 'Str. Mihai Bravu 2, Otopeni',
      companyName: '',
      vatId: '',
      notes: '',
      createdAt: iso(subDays(new Date(), 90)),
    },
    {
      id: C.tribus,
      type: 'pj',
      firstName: 'Andrei',
      lastName: 'Popa',
      phone: '0725 400 100',
      email: 'flota@velocity-rent.ro',
      cnp: '',
      address: 'Șos. Pipera 45, Voluntari',
      companyName: 'Velocity Rent SRL',
      vatId: 'RO41229087',
      notes: 'Flotă 6 mașini, facturare lunară.',
      createdAt: iso(subDays(new Date(), 310)),
    },
    {
      id: C.mihai,
      type: 'pf',
      firstName: 'Mihai',
      lastName: 'Georgescu',
      phone: '0766 112 445',
      email: 'mihai.g@outlook.com',
      cnp: '1850615667788',
      address: 'Str. Turda 108, București',
      companyName: '',
      vatId: '',
      notes: '',
      createdAt: iso(subDays(new Date(), 150)),
    },
    {
      id: C.elena,
      type: 'pf',
      firstName: 'Elena',
      lastName: 'Vasile',
      phone: '0788 330 221',
      email: 'elena.vasile@gmail.com',
      cnp: '2921130445566',
      address: 'Str. Barbu Văcărescu 5, București',
      companyName: '',
      vatId: '',
      notes: '',
      createdAt: iso(subDays(new Date(), 40)),
    },
  ]

  const cars: DB['cars'] = [
    {
      id: A.m4,
      bodyType: 'coupe_sport',
      clientId: C.vlad,
      make: 'BMW',
      model: 'M4 Competition',
      year: 2022,
      engine: '3.0 R6 biturbo (S58)',
      plate: 'B-123-CT',
      vin: 'WBS31AZ0XNCK14021',
      chassis: 'G82-8841',
      color: 'Isle of Man Green',
      notes: '',
      createdAt: iso(subDays(new Date(), 400)),
    },
    {
      id: A.amg,
      bodyType: 'sedan',
      clientId: C.vlad,
      make: 'Mercedes-AMG',
      model: 'C63 S',
      year: 2019,
      engine: '4.0 V8 biturbo (M177)',
      plate: 'B-77-VLD',
      vin: 'WDD2050871F412200',
      chassis: 'W205-4412',
      color: 'Obsidian Black',
      notes: '',
      createdAt: iso(subDays(new Date(), 200)),
    },
    {
      id: A.golf,
      bodyType: 'compacta',
      clientId: C.ana,
      make: 'Volkswagen',
      model: 'Golf 8 GTI',
      year: 2021,
      engine: '2.0 TSI (EA888)',
      plate: 'B-09-ANA',
      vin: 'WVWZZZCDZMW332110',
      chassis: 'CD-3321',
      color: 'Kings Red',
      notes: '',
      createdAt: iso(subDays(new Date(), 220)),
    },
    {
      id: A.rs6,
      bodyType: 'break',
      clientId: C.tribus,
      make: 'Audi',
      model: 'RS6 Avant',
      year: 2023,
      engine: '4.0 V8 TFSI',
      plate: 'IF-88-VLC',
      vin: 'WUAZZZF20PN900412',
      chassis: 'C8-9004',
      color: 'Nardo Grey',
      notes: 'Mașină de flotă — facturare pe firmă.',
      createdAt: iso(subDays(new Date(), 120)),
    },
    {
      id: A.q3,
      bodyType: 'suv',
      clientId: C.mihai,
      make: 'Audi',
      model: 'Q3 Sportback',
      year: 2020,
      engine: '2.0 TDI',
      plate: 'B-44-MHG',
      vin: 'WAUZZZF34LA110987',
      chassis: 'F3-1109',
      color: 'Chronos Grey',
      notes: '',
      createdAt: iso(subDays(new Date(), 150)),
    },
    {
      id: A.tesla,
      bodyType: 'sedan',
      clientId: C.elena,
      make: 'Tesla',
      model: 'Model 3 Performance',
      year: 2024,
      engine: 'Electric · dual motor',
      plate: 'B-10-ELV',
      vin: '5YJ3E7EB4RF223114',
      chassis: 'M3-2231',
      color: 'Pearl White',
      notes: '',
      createdAt: iso(subDays(new Date(), 40)),
    },
    {
      id: A.supra,
      bodyType: 'coupe_sport',
      clientId: C.rares,
      make: 'Toyota',
      model: 'GR Supra',
      year: 2021,
      engine: '3.0 R6 (B58)',
      plate: 'B-30-RMS',
      vin: 'JT2DB8AF0M0012455',
      chassis: 'A90-1245',
      color: 'Nitro Yellow',
      notes: '',
      createdAt: iso(subDays(new Date(), 90)),
    },
  ]

  const stock: DB['stock'] = [
    {
      id: S.ppfGloss,
      category: 'ppf',
      maker: 'SunTek',
      name: 'PPF transparentă lucioasă',
      rollNumber: 'R-04',
      finish: 'lucioasa',
      width: '1.52',
      unit: 'm',
      qty: 35,
      minQty: 15,
      location: 'Raft A1',
      createdAt: iso(subDays(new Date(), 60)),
    },
    {
      id: S.ppfMatte,
      category: 'ppf',
      maker: 'SunTek',
      name: 'PPF transparentă mată',
      rollNumber: 'R-07',
      finish: 'mata',
      width: '1.52',
      unit: 'm',
      qty: 12,
      minQty: 15,
      location: 'Raft A1',
      createdAt: iso(subDays(new Date(), 60)),
    },
    {
      id: S.ppf182,
      category: 'ppf',
      maker: 'STEK',
      name: 'PPF transparentă lucioasă 1.82',
      rollNumber: 'R-11',
      finish: 'lucioasa',
      width: '1.82',
      unit: 'm',
      qty: 22,
      minQty: 10,
      location: 'Raft A2',
      createdAt: iso(subDays(new Date(), 45)),
    },
    {
      id: S.satinGrey,
      category: 'folie_color',
      maker: 'Avery Dennison',
      name: 'Satin Dark Grey',
      rollNumber: 'C-21',
      finish: '',
      width: '1.52',
      unit: 'm',
      qty: 28,
      minQty: 10,
      location: 'Raft B1',
      createdAt: iso(subDays(new Date(), 80)),
    },
    {
      id: S.glossBlack,
      category: 'folie_color',
      maker: '3M',
      name: 'Gloss Black 2080',
      rollNumber: 'C-08',
      finish: '',
      width: '1.52',
      unit: 'm',
      qty: 6,
      minQty: 10,
      location: 'Raft B1',
      createdAt: iso(subDays(new Date(), 130)),
    },
    {
      id: S.tint20,
      category: 'folie_geam',
      maker: 'LLumar',
      name: 'Folie geamuri 20%',
      rollNumber: 'G-02',
      finish: '',
      width: '1.52',
      unit: 'm',
      qty: 40,
      minQty: 12,
      location: 'Raft C1',
      createdAt: iso(subDays(new Date(), 30)),
    },
    {
      id: S.krytex9h,
      category: 'ceramica',
      maker: 'Krytex',
      name: 'Krytex 9H + Mega 8',
      rollNumber: 'KX-99182',
      finish: '',
      width: '',
      unit: 'buc',
      qty: 4,
      minQty: 2,
      location: 'Dulap ceramice',
      createdAt: iso(subDays(new Date(), 70)),
    },
    {
      id: S.krytexRims,
      category: 'ceramica',
      maker: 'Krytex',
      name: 'Krytex Mega Rims',
      rollNumber: 'KX-77012',
      finish: '',
      width: '',
      unit: 'buc',
      qty: 1,
      minQty: 2,
      location: 'Dulap ceramice',
      createdAt: iso(subDays(new Date(), 70)),
    },
  ]

  const notifications: DB['notifications'] = [
    {
      id: uid(),
      jobId: done1.id,
      clientId: C.ana,
      kind: 'retus_7z',
      channel: 'sms',
      dueAt: at(1, 10),
      status: 'programata',
      message:
        'Custom Tuning: folia are nevoie de un retuș la 7 zile. Te așteptăm în atelier — sună la 0722 000 000 pentru o oră.',
      sentAt: null,
    },
    {
      id: uid(),
      jobId: done2.id,
      clientId: C.mihai,
      kind: 'retus_7z',
      channel: 'sms',
      dueAt: at(-8, 10),
      status: 'trimisa',
      message: 'Custom Tuning: te așteptăm la retuș.',
      sentAt: at(-8, 10, 5),
    },
    {
      id: uid(),
      jobId: done2.id,
      clientId: C.mihai,
      kind: 'retus_reminder_3z',
      channel: 'sms',
      dueAt: at(-5, 10),
      status: 'programata',
      message: 'Custom Tuning: reamintire — retușul foliei este încă disponibil. Te așteptăm!',
      sentAt: null,
    },
    {
      id: uid(),
      jobId: done2.id,
      clientId: C.mihai,
      kind: 'detailing_6l',
      channel: 'whatsapp',
      dueAt: at(165, 10),
      status: 'programata',
      message:
        'Custom Tuning: au trecut 6 luni de la detailingul mașinii tale. Te invităm la o nouă ședință de detailing cu 10% reducere, în limita locurilor libere din calendar. Programează-te la 0722 000 000!',
      sentAt: null,
    },
  ]

  const moves: DB['moves'] = [
    {
      id: uid(),
      stockItemId: S.ppf182,
      delta: -9,
      reason: 'Consum lucrare PRG-2037 · Golf 8 GTI',
      jobId: done1.id,
      at: at(-6, 16),
      by: 'Andrei Pavel',
    },
  ]

  // istoric evenimente pentru lucrarea în curs
  jobs[0].events = [
    { id: uid(), at: at(-2, 12), label: 'Programare creată', by: 'Cosmin Dinu' },
    { id: uid(), at: at(0, 9), label: 'Mașină primită în atelier', by: 'Andrei Pavel' },
    { id: uid(), at: at(0, 9, 20), label: 'Status → În lucru', by: 'Andrei Pavel' },
  ]

  /** Echipa completă a atelierului — 30 de oameni, cu vechimi diferite. */
  const TEAM: [id: string, name: string, role: DB['staff'][number]['role'], position: string, hire: string][] = [
    ['stf-andrei', 'Andrei Pavel', 'owner', 'Fondator', '2016-03-01'],
    ['stf-cosmin', 'Cosmin Dinu', 'manager', 'Manager atelier', '2017-09-15'],
    ['stf-robert', 'Robert Ilie', 'operator', 'Aplicator folie', '2019-04-01'],
    ['stf-daniel', 'Daniel Marin', 'operator', 'Aplicator folie', '2020-06-15'],
    ['stf-05', 'Alexandru Popa', 'operator', 'Aplicator PPF', '2018-02-05'],
    ['stf-06', 'Mihai Georgescu', 'operator', 'Aplicator PPF', '2021-01-11'],
    ['stf-07', 'Ionuț Stan', 'operator', 'Detailing', '2019-11-04'],
    ['stf-08', 'Vlad Nistor', 'operator', 'Detailing', '2022-03-21'],
    ['stf-09', 'Gabriel Toma', 'operator', 'Detailing', '2023-05-08'],
    ['stf-10', 'Cătălin Rusu', 'operator', 'Protecții ceramice', '2018-07-16'],
    ['stf-11', 'Sorin Bălan', 'operator', 'Protecții ceramice', '2021-09-06'],
    ['stf-12', 'Marius Enache', 'operator', 'Jante & anvelope', '2017-05-02'],
    ['stf-13', 'Bogdan Sava', 'operator', 'Jante & anvelope', '2022-08-01'],
    ['stf-14', 'Adrian Lupu', 'operator', 'Mecanică / suspensii', '2019-01-14'],
    ['stf-15', 'Florin Damian', 'operator', 'Mecanică / suspensii', '2020-10-19'],
    ['stf-16', 'Ovidiu Crăciun', 'operator', 'Evacuări', '2018-11-12'],
    ['stf-17', 'Radu Ionescu', 'operator', 'Chip tuning', '2021-04-05'],
    ['stf-18', 'Paul Mihăilă', 'operator', 'Chip tuning', '2024-02-12'],
    ['stf-19', 'Ștefan Anghel', 'operator', 'Bodykit / tuning', '2019-06-03'],
    ['stf-20', 'Cristian Petrescu', 'operator', 'Bodykit / tuning', '2023-09-18'],
    ['stf-21', 'Nicolae Barbu', 'operator', 'Pregătire suprafețe', '2020-02-24'],
    ['stf-22', 'Iulian Voicu', 'operator', 'Pregătire suprafețe', '2024-06-10'],
    ['stf-23', 'Denis Radu', 'operator', 'Folii geamuri', '2022-01-17'],
    ['stf-24', 'Emil Ciobanu', 'operator', 'Folii geamuri', '2025-03-03'],
    ['stf-25', 'Laura Vasilescu', 'manager', 'Front-desk / programări', '2018-09-10'],
    ['stf-26', 'Andreea Dobre', 'operator', 'Front-desk / programări', '2023-01-09'],
    ['stf-27', 'Elena Moraru', 'manager', 'Financiar', '2019-03-25'],
    ['stf-28', 'Diana Chiriac', 'operator', 'Marketing / social', '2024-09-02'],
    ['stf-29', 'Tudor Albu', 'operator', 'Logistică & stoc', '2021-11-15'],
    ['stf-30', 'Alin Munteanu', 'operator', 'Ucenic aplicator', '2026-02-02'],
  ]

  const STAFF_COLORS = ['#e02a2a', '#5b8def', '#3ecf8e', '#f0a93b', '#b05cd6', '#0fa3a3', '#d13a54', '#7d8189']

  const staff: DB['staff'] = TEAM.map(([id, name, role, position, hire], i) => ({
    id,
    name,
    role,
    position,
    hireDate: hire,
    /** ucenicii au minimul legal, restul 21 de zile */
    annualLeaveDays: position === 'Ucenic aplicator' ? 20 : 21,
    color: STAFF_COLORS[i % STAFF_COLORS.length],
    active: true,
  }))

  const dayKey = (offset: number) => at(offset, 12).slice(0, 10)

  const timeOff: DB['timeOff'] = [
    {
      id: uid(),
      staffId: 'stf-robert',
      type: 'concediu',
      startDate: dayKey(6),
      endDate: dayKey(13),
      note: 'Concediu de odihnă — aprobat în ianuarie.',
      approved: true,
      createdAt: iso(subDays(new Date(), 30)),
      createdBy: 'Andrei Pavel',
    },
    {
      id: uid(),
      staffId: 'stf-daniel',
      type: 'liber',
      startDate: dayKey(2),
      endDate: dayKey(2),
      note: 'Recuperare weekend lucrat.',
      approved: false,
      createdAt: iso(subDays(new Date(), 2)),
      createdBy: 'Cosmin Dinu',
    },
    {
      id: uid(),
      staffId: 'stf-cosmin',
      type: 'training',
      startDate: dayKey(20),
      endDate: dayKey(21),
      note: 'Training Krytex — certificare aplicator.',
      approved: true,
      createdAt: iso(subDays(new Date(), 10)),
      createdBy: 'Andrei Pavel',
    },
    {
      id: uid(),
      staffId: 'stf-andrei',
      type: 'inchis',
      startDate: dayKey(35),
      endDate: dayKey(45),
      note: 'Atelier închis — concediu colectiv de vară.',
      approved: true,
      createdAt: iso(subDays(new Date(), 40)),
      createdBy: 'Andrei Pavel',
    },
  ]

  /** Istoric + cereri pentru restul echipei, ca soldul de concediu să aibă sens. */
  const moreLeave: Array<[staffId: string, type: DB['timeOff'][number]['type'], from: number, to: number, approved: boolean, note: string]> = [
    ['stf-05', 'concediu', -120, -106, true, 'Concediu de iarnă.'],
    ['stf-05', 'concediu', 24, 33, false, 'Cerere — nuntă în familie.'],
    ['stf-06', 'concediu', -60, -54, true, 'Concediu de primăvară.'],
    ['stf-07', 'concediu', -20, -14, true, 'Concediu.'],
    ['stf-07', 'medical', -5, -3, true, 'Concediu medical — 3 zile.'],
    ['stf-08', 'concediu', 4, 15, true, 'Concediu de vară — aprobat.'],
    ['stf-09', 'concediu', 11, 18, false, 'Cerere — vacanță Grecia.'],
    ['stf-10', 'concediu', -200, -186, true, 'Concediu de iarnă.'],
    ['stf-10', 'concediu', 2, 9, true, 'Concediu de vară.'],
    ['stf-11', 'liber', 1, 1, false, 'Recuperare sâmbătă lucrată.'],
    ['stf-12', 'concediu', -45, -31, true, 'Concediu.'],
    ['stf-13', 'concediu', 18, 25, true, 'Concediu de vară.'],
    ['stf-14', 'concediu', -90, -83, true, 'Concediu.'],
    ['stf-15', 'medical', -12, -8, true, 'Medical.'],
    ['stf-16', 'concediu', 7, 21, true, 'Concediu — 3 săptămâni.'],
    ['stf-17', 'concediu', -30, -23, true, 'Concediu.'],
    ['stf-18', 'training', 5, 6, true, 'Training Autotuner.'],
    ['stf-19', 'concediu', -150, -136, true, 'Concediu de iarnă.'],
    ['stf-20', 'concediu', 30, 44, false, 'Cerere — concediu septembrie.'],
    ['stf-21', 'concediu', -70, -63, true, 'Concediu.'],
    ['stf-23', 'concediu', 1, 5, true, 'Concediu scurt.'],
    ['stf-25', 'concediu', -100, -86, true, 'Concediu.'],
    ['stf-25', 'concediu', 40, 54, true, 'Concediu de toamnă.'],
    ['stf-26', 'concediu', 3, 7, false, 'Cerere — city break.'],
    ['stf-27', 'concediu', -25, -18, true, 'Concediu.'],
    ['stf-29', 'concediu', 13, 20, true, 'Concediu.'],
    ['stf-30', 'liber', 9, 9, false, 'Zi liberă — examen.'],
  ]

  moreLeave.forEach(([staffId, type, from, to, approved, note]) => {
    timeOff.push({
      id: uid(),
      staffId,
      type,
      startDate: dayKey(from),
      endDate: dayKey(to),
      note,
      approved,
      createdAt: iso(subDays(new Date(), Math.max(1, Math.abs(from) + 5))),
      createdBy: 'Cosmin Dinu',
    })
  })

  return {
    clients,
    cars,
    jobs,
    stock,
    moves,
    notifications,
    staff,
    timeOff,
    settings: defaultSettings(),
    currentUserId: 'stf-cosmin',
  }
}
