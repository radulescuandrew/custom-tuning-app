# Custom Tuning · Trecere mobile-first + calendar de nivel Google Calendar

Data: 2026-08-03
Stare: aprobat pentru planificare

## Context

Aplicația (`custom-tuning-app`, Vite + React 19 + TS + Tailwind v4 + React Router + Zustand + FullCalendar)
a fost construită ca back-office de desktop. În atelier o folosesc de pe telefon atât operatorii, cât și
managerul care ține programările.

Stare actuală măsurată:

- `AppLayout.tsx` — sidebar fix de 236px, fără drawer, fără bară de navigație; layout-ul nu are variantă sub 768px.
- 40 de clase responsive (`sm:`/`lg:`/`xl:`) în tot `src/` — practic zero adaptare mobilă.
- `JobCalendar.tsx` — două bare de instrumente care se sparg pe 390px lățime; drag & drop gândit pentru mouse.
- Ecrane grele: `JobDetailPage` 663 linii, `JobNewPage` 524, `StockPage` 486, `QuickCreateModal` 476.
- Tabele cu `overflow-x-auto` în 6 pagini — pe telefon devin scroll orizontal.

## Obiectiv

1. Aplicația se folosește confortabil de pe telefon, cu o mână, cu mâinile murdare, în atelier.
2. Calendarul de pe telefon se comportă ca Google Calendar: swipe între perioade, long-press pentru
   creare, long-press + drag pentru mutare, sheet de detalii.
3. Desktopul nu regresează.

Non-obiective: backend, autentificare reală, offline sync, notificări push, aplicație nativă.

## Decizii

| Decizie | Aleasă | Motiv |
|---|---|---|
| Acoperire | Shell + toate ecranele + calendar | Aplicația e folosită zilnic de pe telefon; ecrane pe jumătate adaptate ar rămâne blocante |
| Calendar | Hibrid — FullCalendar pe desktop, view-uri custom pe telefon | FullCalendar pe touch e chinuit: drag prin long-press nativ imprecis, hit targets mici, month view ilizibil pe 390px. Rescrierea totală ar arunca layout-ul de suprapunere și resize-ul, deja rezolvate pe desktop |
| Mutare pe telefon | Long-press ridică blocul + drag cu auto-scroll (plus sheet cu ore exacte ca alternativă) | E gestul deja cunoscut din Google Calendar; sheet-ul acoperă ajustarea fină |
| Ecran de start | Operator → lucrările lui de azi; manager/owner → calendar, view Zi | Rolurile au treburi diferite în atelier |
| PWA | Da: manifest + iconițe + `display:standalone` + `theme-color`, plus invitație de instalare pe telefon. Fără service worker | Datele stau deja local; offline-ul complet nu aduce nimic în plus. Instalarea scoate bara de browser și dă spațiu vertical calendarului |
| Teste | vitest + testing-library, **doar pentru logica pură** | UI-ul se verifică vizual; bug-urile tăcute stau în calcule |

---

## 1. Fundament

### Breakpoint

Un singur breakpoint: **`md` = 768px**. Baza CSS este telefonul; `md:` adaugă desktopul.
Nu se mai scriu stiluri de desktop anulate ulterior pe mobil.

Unde diferă *componenta*, nu doar layout-ul (calendar, modal vs. sheet), decide hook-ul
`useMediaQuery('(min-width:768px)')`, ca să nu se monteze ambii arbori simultan.

### Primitive noi în `components/ui/`

| Primitivă | Contract | Depinde de |
|---|---|---|
| `Sheet` | `{ open, onClose, title?, children, footer? }` — bottom sheet, drag-to-dismiss, `max-h:92dvh`, scroll intern, footer lipit jos | — |
| `Modal` (modificat) | Aceeași semnătură ca azi. Peste `md` randează dialogul actual, sub `md` randează `Sheet` | `Sheet`, `useMediaQuery` |
| `DataList<T>` | `{ items, columns, renderCard, onRowClick? }` — tabel peste `md`, listă de carduri sub | — |
| `SegmentedControl` | `{ options, value, onChange }` — comutator de vizualizare | — |
| `StickyBar` | container lipit jos, cu `safe-area-inset-bottom`, pentru acțiuni primare | — |
| `Stepper` | `{ value, onChange, step, min?, max? }` — butoane +/- de 44px | — |

`Modal` schimbat înseamnă că `QuickCreateModal`, `ClientModal` și `CarModal` devin bottom sheets
fără să le fie atins conținutul.

### Reguli globale

- Hit target minim 44×44 px pentru orice element atingibil.
- `100dvh` în loc de `100vh` / `h-full` pe containerele de ecran (bara Safari pe iOS).
- `env(safe-area-inset-bottom)` pe bara de tab-uri, pe `StickyBar` și pe footer-ele de sheet.
- Inputurile au `font-size: 16px` pe mobil — sub această valoare iOS face zoom automat la focus.
- `touch-action` explicit pe zonele cu gesturi proprii (blocuri de calendar, pager).

---

## 2. Shell mobil

### Sub `md`

- **Header sticky**: logo mic · lupă · avatar. Înălțime 56px.
- **Bottom tab bar**, 5 intrări: **Azi · Calendar · Clienți · Stoc · Mai multe**.
- **„Mai multe"** deschide un `Sheet`: Mașini, Notificări, Concedii (doar owner/manager), Rapoarte,
  Setări (doar owner/manager), schimbare utilizator, „Resetează demo".
- **FAB** roșu „+" deasupra tab bar-ului, vizibil pe Azi și Calendar → programare nouă.
- **Căutarea globală** devine overlay full-screen, deschis din lupă.
- **Toasts** apar sus; jos ar cădea sub tab bar.

### Peste `md`

Sidebar-ul actual rămâne neschimbat. `AppLayout` alege între cele două shell-uri.

### Rutare la intrare, după rol

| Rol | Ecran |
|---|---|
| Operator (Robert, Daniel) | `/azi` — pagină nouă: lucrările lui de azi, listă simplă cu ▶ Începe / ■ Finalizează |
| Manager, Owner | `/programari`, vizualizarea Zi |

Pe desktop comportamentul rămâne cel de azi (Dashboard). Restricțiile existente de rol
(`canSeeTimeOff`, Setări) rămân valabile identic în shell-ul mobil, inclusiv pe rutele directe.

### PWA

`public/manifest.webmanifest` cu nume, iconițe 192/512 (plus 180px `apple-touch-icon`),
`display:standalone`, `background_color` și `theme_color` din paleta de brand. Fără service worker.

**Invitație de instalare pe telefon** — componenta `InstallPrompt`, un `Sheet` cu logo, o frază
(„Adaugă Custom Tuning pe ecranul principal — se deschide ca o aplicație, fără bara de browser")
și butoanele **Instalează** / **Mai târziu**.

Două căi, pentru că iOS nu are API de instalare:

| Platformă | Comportament |
|---|---|
| Android / Chrome | Se interceptează evenimentul `beforeinstallprompt`, se face `preventDefault()` și se păstrează. „Instalează" apelează `prompt()` pe el; rezultatul (`accepted` / `dismissed`) se consemnează |
| iOS Safari | `beforeinstallprompt` nu există. Sheet-ul arată instrucțiunile ilustrate: butonul Partajare → „Adaugă la ecranul principal" |

Reguli de afișare, ca să nu devină enervant:

- Nu apare deloc dacă aplicația rulează deja instalată (`display-mode: standalone`, sau
  `navigator.standalone` pe iOS), nici peste `md`.
- Apare la a doua vizită și numai după 30 de secunde de folosire — nu peste primul ecran.
- „Mai târziu" sau instalarea reușită se rețin în localStorage. Amânarea reduce la tăcere
  invitația pentru 14 zile; instalarea o oprește definitiv.
- Rămâne o intrare permanentă „Instalează aplicația" în sheet-ul „Mai multe", pentru cine a amânat.

Starea stă într-un hook `useInstallPrompt` — detectare platformă, disponibilitate, amânare —
ca UI-ul să nu conțină logică de platformă.

---

## 3. Calendarul

### Sursă unică de evenimente

`useCalendarEvents(jobs)` se extrage din `JobCalendar.tsx` și devine singurul loc unde se
construiesc cele trei straturi — primire, execuție, concedii — cu culorile lor pe status.
Îl consumă atât FullCalendar (desktop), cât și `MobileCalendar`.

### Vizualizări pe telefon

| View | Conținut |
|---|---|
| **Agendă** (implicit) | Listă continuă pe zile, antet de zi sticky, gol marcat explicit („nimic programat") |
| **Zi** | Grilă orară 07:00–21:00, slot 30 min |
| **3 zile** | Aceeași grilă, trei coloane |

Comutare prin `SegmentedControl` în bara de sus. Vizualizarea „Lună" nu există pe telefon —
mini-luna din selectorul de dată acoperă nevoia de orientare.

### Navigare

Pager cu trei pagini (anterioară / curentă / următoare), swipe orizontal cu animație de tip spring.
Bara de dată afișează perioada („august 2026"); tap deschide un `Sheet` cu mini-lună, în care
fiecare zi are un punct de densitate (număr de lucrări).

### Grila orară

- Linie „acum" roșie, actualizată la minut.
- Evenimentele sunt poziționate absolut, pe baza unui layout de suprapunere propriu:
  sortare după start → grupare în clustere care se suprapun → repartizare pe coloane paralele.
- Concediile apar ca bandă all-day sus, doar pentru owner/manager.

### Gestul de mutare — `useLongPressDrag`

Implementat pe pointer events, nu pe touch events, ca să meargă identic cu mouse-ul în DevTools.

1. Long-press 400ms pe un bloc → `navigator.vibrate(10)`, blocul se ridică (scale 1.03 + umbră),
   apare un badge cu ora curentă a blocului.
2. Drag. Când degetul intră în ultimele 15% din înălțimea vizibilă (sus sau jos), pornește
   auto-scroll cu viteză proporțională cu adâncimea în zonă.
3. Poziția face snap la 15 minute; badge-ul arată ora nouă în timp real.
4. La ridicarea degetului: `updateJob` + toast. Anulare cu Escape sau prin drag înapoi la poziția inițială.
5. Cât blocul e ridicat, apar două mânere de resize (sus / jos) de 44px; același snap de 15 minute.

`touch-action: none` pe blocuri — altfel scroll-ul paginii fură gestul.

Regulile de scriere sunt cele existente: stratul **primire** actualizează `startAt` / `durationMin`,
stratul **execuție** actualizează `workStartAt` / `workEndAt` / `estimateMin` + `estimateManual`,
concediile nu se pot muta.

### Creare

Long-press pe un slot gol → `QuickCreateModal` (deja devenit sheet), cu ziua și ora precompletate,
durată implicită 30 min pentru primire.

### Detalii eveniment

Tap pe bloc → `EventSheet`: client, mașină, servicii, status, operator. Acțiuni:

- Deschide fișa
- ▶ Începe / ■ Finalizează (după status)
- Sună clientul (`tel:`)
- Mută — sheet cu oră și durată exacte, alternativa la drag

### Filtre

Filtrele pe operator și pe strat se mută într-un `Sheet` „Filtre", deschis dintr-un buton care arată
numărul de filtre active. Azi ocupă un rând întreg din ecranul telefonului.

### Desktop

`JobCalendar.tsx` rămâne pe FullCalendar, cu aceleași funcții, dar consumă `useCalendarEvents`
și primește un toolbar care nu se mai sparge sub 900px.

---

## 4. Ecranele

| Ecran | Tratament pe telefon |
|---|---|
| **Azi** (nou) | Lucrările operatorului curent, azi. Card = mașină, client, servicii, status + ▶/■ |
| **Clienți, Mașini, Programări, Notificări** | `DataList` — card cu titlu, două rânduri meta, badge de status |
| **Stoc** | Carduri cu `Stepper` de 44px pentru +/−; mișcarea de stoc în sheet; jurnalul ca listă |
| **Programare nouă** | Pas cu pas pe ecran plin, un câmp pe rând, bară de progres sus, `StickyBar` jos (Înapoi / Continuă). Fișierul se sparge în `pages/job-new/Step*.tsx` |
| **Fișă programare** | Header sticky cu status + acțiunea primară; conținutul devine acordeon: Servicii · Poze · Bani · Notificări · Istoric. Fișierul se sparge pe secțiuni în `pages/job-detail/` |
| **Concedii** | Listă de carduri; selectorul de perioadă în sheet |
| **Rapoarte** | Carduri KPI + bare simple, fără tabele late |
| **Setări** | Formular pe un rând |
| **Dashboard** | KPI-uri 2 pe rând, liste scurtate |
| **Tracking public** | Ecranul pe care clientul îl deschide efectiv pe telefon — trecere completă, prioritate egală cu calendarul |

Fișa PDF (print) rămâne neschimbată.

---

## 5. Structura fișierelor

```
src/
  components/
    mobile/     BottomTabBar · MoreSheet · Fab · MobileHeader · SearchOverlay · InstallPrompt
    ui/         Sheet · SegmentedControl · StickyBar · DataList · Stepper  (+ ui.tsx existent)
    calendar/   useCalendarEvents · useLongPressDrag · MobileCalendar
                AgendaView · TimeGridView · EventSheet · CalendarFilters
                JobCalendar (desktop)
  hooks/        useMediaQuery · useHaptics · useInstallPrompt
  pages/        AziPage (nou) · job-new/* · job-detail/*
```

Fiecare unitate are un scop unic și o interfață explicită: `useCalendarEvents` produce evenimente și
nu știe nimic despre randare; `useLongPressDrag` produce (element, delta timp) și nu știe nimic despre
`Job`; view-urile randează și nu scriu în store direct.

---

## 6. Verificare

### Teste automate — doar logica pură

Se adaugă `vitest` + `@testing-library/react`. Acoperire:

- layout-ul de suprapunere din grila orară (clustere, coloane)
- snap-ul la 15 minute și calculul auto-scroll-ului
- `useCalendarEvents` — cele trei straturi, filtrarea concediilor după rol
- `lib/money.ts` — bază / TVA / total (nu e acoperit azi și se atinge în ecranele de bani)

### Verificare vizuală

Prin argent (Chrome CDP), la **390×844** (iPhone 14) și **360×800** (Android obișnuit),
cu screenshot pentru fiecare ecran, în ambele roluri.

### Poartă de finalizare

`npm run build` și `oxlint` fără erori; niciun scroll orizontal la 360px pe niciun ecran.

---

## Riscuri

| Risc | Atenuare |
|---|---|
| Drag-ul fură scroll-ul paginii pe iOS | `touch-action:none` pe blocuri, prag de mișcare înainte de a prelua gestul |
| `navigator.vibrate` nu există pe iOS Safari | `useHaptics` degradează tăcut; feedback-ul rămâne vizual |
| Bara de adrese Safari schimbă înălțimea | `100dvh` + recalculare la `resize` în grila orară |
| Fișierele mari se sparg și se pierde comportament | Se sparg mecanic, fără schimbări de logică, într-un pas separat de restul lucrării |
| Datele demo (localStorage) se pierd la schimbări de schemă | Nu se schimbă schema în această rundă |
| `beforeinstallprompt` nu se declanșează (Chrome cere manifest valid, HTTPS și un minim de interacțiune) | Se testează pe deploy-ul real, nu doar pe `localhost`; dacă evenimentul lipsește, `InstallPrompt` cade pe varianta cu instrucțiuni, ca pe iOS |

## Presupuneri consemnate

- Aplicația rămâne fără backend și fără autentificare reală; rolul vine în continuare din selectorul demo.
- Nu se schimbă `data/types.ts` — trecerea e de prezentare și interacțiune.
- Proiectul nu este sub git; specificația nu se poate comita (`git init` la cerere).
