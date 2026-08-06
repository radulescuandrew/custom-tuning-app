# Custom Tuning · Mobile-first + calendar Google-Calendar-grade · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `custom-tuning-app` from a desktop back-office into a phone-first workshop app with a touch calendar that behaves like Google Calendar, installable as a PWA.

**Architecture:** One breakpoint (`md` = 768px), phone as the CSS base. Where the *component* must differ (calendar, modal vs. sheet) a `useMediaQuery` hook picks the tree, so only one is mounted. The calendar splits into a shared data layer (`useCalendarEvents`) plus two renderers: FullCalendar on desktop (unchanged behaviour) and a purpose-built `MobileCalendar` on phones. Pure calendar geometry (overlap columns, 15-min snap, auto-scroll speed) lives in a dependency-free module and is unit-tested; the rest is verified visually.

**Tech Stack:** Vite 8, React 19, TypeScript 6, Tailwind v4, React Router 7, Zustand 5, FullCalendar 6 (desktop only), date-fns 4, idb-keyval, Vitest + Testing Library (new).

**Spec:** `docs/superpowers/specs/2026-08-03-mobile-first-calendar-design.md`

## Revision · 2026-08-06

Phases 0–2 are implemented and Phase 3 is half-done (`manifest.webmanifest` and the icons exist,
`InstallPrompt` does not) even though the checkboxes below are untouched. Phases 4–5 have not started.

Changed in this revision, after looking at how `/programari` actually renders on a phone:

- **Month view stays on mobile and becomes the default.** The original call („illegible at 390px") was
  about the cell contents, not the view — as a density map it works. Task 17b is new; the cell renders
  status dots and a total instead of truncated text.
- **`DatePickerSheet` is dropped** from Task 18 — the month view makes it redundant.
- **Task 11** gains `dayDensity` plus its tests; **Task 14**'s pager gains a month step.
- **Task 19** makes `JobsPage` full-bleed below `md`; the status filters and the search field move into
  `CalendarFilters`.

`InstallPrompt` (Task 10) and Phase 6 stay outside the current round of work.

## Global Constraints

- **Breakpoint:** exactly one — `md` (768px). Phone styles are the unprefixed base; `md:` adds desktop. Never write a desktop style that a mobile style has to undo.
- **Touch targets:** every interactive element is at least 44×44 CSS px on phone.
- **Viewport height:** use `100dvh`, never `100vh` or `h-full`, on screen-level containers.
- **Safe area:** bottom tab bar, `StickyBar` and sheet footers must add `env(safe-area-inset-bottom)`.
- **Inputs:** `font-size: 16px` minimum on phone — below that iOS Safari zooms on focus.
- **Language:** all user-visible copy in Romanian, with diacritics. Money is RON, formatted via `fmtRon` from `@/lib/money`.
- **No schema changes:** `src/data/types.ts` is not modified by this plan. Demo data in localStorage must keep loading.
- **Imports:** use the `@/` alias. `verbatimModuleSyntax` is on — type-only imports must use `import type`.
- **Desktop must not regress:** every screen keeps its current desktop appearance and behaviour.
- **Commits:** one commit per task, message in English, conventional-commit prefix.
- **Verification per task:** `npx tsc -b` and `npm run lint` must be clean before the commit step.

---

## File Structure

**Created**

```
src/hooks/useMediaQuery.ts          media query → boolean, SSR-safe
src/hooks/useHaptics.ts             vibrate wrapper, no-op where unsupported
src/hooks/useInstallPrompt.ts       PWA install availability + deferral state

src/components/ui/Sheet.tsx             bottom sheet, drag-to-dismiss
src/components/ui/SegmentedControl.tsx  view switcher
src/components/ui/StickyBar.tsx         bottom action bar
src/components/ui/Stepper.tsx           44px +/- control
src/components/ui/DataList.tsx          table (md) / cards (phone)

src/components/mobile/MobileHeader.tsx  56px sticky top bar
src/components/mobile/SearchOverlay.tsx full-screen global search
src/components/mobile/BottomTabBar.tsx  5-tab navigation
src/components/mobile/MoreSheet.tsx     overflow menu
src/components/mobile/Fab.tsx           floating "+" action
src/components/mobile/InstallPrompt.tsx PWA install sheet

src/components/calendar/layout.ts             pure geometry (tested)
src/components/calendar/useCalendarEvents.ts  single source of calendar events
src/components/calendar/fullCalendarAdapter.ts CalEvent → FullCalendar EventInput
src/components/calendar/useLongPressDrag.ts   long-press → drag → snap → drop
src/components/calendar/MobileCalendar.tsx    mobile shell (date bar + views)
src/components/calendar/CalendarPager.tsx     swipe between periods
src/components/calendar/TimeGridView.tsx      day / 3-day grid
src/components/calendar/MonthView.tsx         month grid, density cells
src/components/calendar/AgendaView.tsx        schedule list
src/components/calendar/EventSheet.tsx        event details + actions
src/components/calendar/CalendarFilters.tsx   layers · operator · status · search

src/pages/AziPage.tsx               operator landing: today's jobs
src/pages/job-new/*                 wizard split into steps
src/pages/job-detail/*              job sheet split into sections

public/manifest.webmanifest
public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
```

**Moved**

```
src/components/JobCalendar.tsx → src/components/calendar/JobCalendar.tsx  (desktop renderer)
```

**Modified**

`src/index.css`, `index.html`, `vite.config.ts`, `package.json`, `tsconfig.app.json`, `src/App.tsx`,
`src/components/AppLayout.tsx`, `src/components/ui.tsx`, and every page under `src/pages/`.

---

## Phase 0 · Harness

### Task 1: Git repository and test harness

The project is not under version control and has no test runner. Both are prerequisites for every later task.

**Files:**
- Create: `.git/` (via `git init`), `src/lib/money.test.ts`
- Modify: `package.json`, `vite.config.ts`, `tsconfig.app.json`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` (vitest run), `npm run test:watch`; jsdom environment available to all later tests

- [ ] **Step 1: Initialise the repository and take a baseline commit**

```bash
cd custom-tuning-app
git init
git add -A
git commit -m "chore: baseline before mobile-first rework"
```

- [ ] **Step 2: Install the test toolchain**

```bash
npm i -D vitest@^3 jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom
```

- [ ] **Step 3: Configure vitest**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the first tests — VAT decomposition**

`src/lib/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { amounts, fmtRon } from './money'
import type { Settings } from '@/data/types'

const base: Settings = {
  companyName: 'Custom Tuning SRL',
  vatId: 'RO12345678',
  vatPayer: true,
  vatRate: 21,
  pricesIncludeVat: true,
}

describe('amounts', () => {
  it('extrage TVA-ul dintr-un preț final', () => {
    const a = amounts(5600, base)
    expect(a.gross).toBe(5600)
    expect(a.net).toBe(4628.1)
    expect(a.vat).toBe(971.9)
    expect(a.showsVat).toBe(true)
  })

  it('adaugă TVA peste un preț de bază', () => {
    const a = amounts(1000, { ...base, pricesIncludeVat: false })
    expect(a.net).toBe(1000)
    expect(a.vat).toBe(210)
    expect(a.gross).toBe(1210)
  })

  it('nu arată nicio linie de TVA pentru firmă neplătitoare', () => {
    const a = amounts(1000, { ...base, vatPayer: false })
    expect(a).toMatchObject({ net: 1000, vat: 0, gross: 1000, rate: 0, showsVat: false })
  })
})

describe('fmtRon', () => {
  it('omite zecimalele pentru sume întregi', () => {
    expect(fmtRon(8900)).toBe('8.900 RON')
  })
})
```

If the `Settings` fields above do not match `src/data/types.ts`, fix the fixture to match the real
interface — the type is the source of truth, not this snippet.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: 4 passing tests.

- [ ] **Step 6: Verify the build still typechecks**

Run: `npx tsc -b && npm run lint`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add vitest harness and money unit tests"
```

---

## Phase 1 · Fundament

### Task 2: Mobile CSS base and platform hooks

**Files:**
- Create: `src/hooks/useMediaQuery.ts`, `src/hooks/useMediaQuery.test.ts`, `src/hooks/useHaptics.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `useMediaQuery(query: string): boolean`
  - `useIsDesktop(): boolean` — `useMediaQuery('(min-width: 768px)')`
  - `useHaptics(): { tap: () => void }` — `tap` calls `navigator.vibrate(10)` when available
  - CSS: `.pb-safe`, `.pt-safe`, `.h-dvh-screen` utilities

- [ ] **Step 1: Write the failing test**

`src/hooks/useMediaQuery.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    emit(matches: boolean) {
      mql.matches = matches
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
    },
  }
}

describe('useMediaQuery', () => {
  it('returnează starea inițială', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('reacționează la schimbarea lățimii', () => {
    const mm = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    act(() => mm.emit(true))
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/hooks/useMediaQuery.test.ts`
Expected: FAIL — cannot resolve `./useMediaQuery`.

- [ ] **Step 3: Implement the hooks**

`src/hooks/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Singurul breakpoint din aplicație. Sub el = telefon. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
```

`src/hooks/useHaptics.ts`:

```ts
import { useCallback } from 'react'

/** iOS Safari nu implementează Vibration API — degradează tăcut. */
export function useHaptics() {
  const tap = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10)
  }, [])
  return { tap }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/hooks/useMediaQuery.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the mobile CSS base**

In `src/index.css`, inside `@layer base`, replace the `html, body, #root { height: 100% }` rule with:

```css
  html,
  body,
  #root {
    height: 100dvh;
  }
  body {
    overscroll-behavior-y: none;
  }
  /* iOS Safari face zoom la focus dacă inputul e sub 16px */
  @media (max-width: 767px) {
    input,
    select,
    textarea {
      font-size: 16px;
    }
  }
```

Append after the `mono-label` utility:

```css
@utility pb-safe {
  padding-bottom: max(env(safe-area-inset-bottom), 0.5rem);
}

@utility pt-safe {
  padding-top: env(safe-area-inset-top);
}

@utility no-tap-highlight {
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc -b && npm run lint && npm test`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add media query and haptics hooks, mobile CSS base"
```

---

### Task 3: Sheet primitive and responsive Modal

**Files:**
- Create: `src/components/ui/Sheet.tsx`
- Modify: `src/components/ui.tsx` (the `Modal` export)

**Interfaces:**
- Consumes: `useIsDesktop` (Task 2)
- Produces:
  - `Sheet({ open, onClose, title?, subtitle?, children, footer? })`
  - `Modal` keeps its current props (`open, onClose, title, subtitle?, children, footer?, width?`) and renders `Sheet` below `md`

- [ ] **Step 1: Implement `Sheet`**

`src/components/ui/Sheet.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/lib/utils'

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const [dragY, setDragY] = useState(0)
  const startY = useRef(0)
  const dragging = useRef(false)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) setDragY(0)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ opacity: Math.max(0, 1 - dragY / 400) }}
      />
      <div
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border-t border-line-strong bg-ink-850 shadow-2xl"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging.current ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* mânerul de tras — singura zonă care închide prin gest */}
        <div
          className="flex-none cursor-grab touch-none py-3"
          onPointerDown={(e) => {
            dragging.current = true
            startY.current = e.clientY
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return
            setDragY(Math.max(0, e.clientY - startY.current))
          }}
          onPointerUp={() => {
            dragging.current = false
            setDragY((y) => {
              if (y > 110) {
                onClose()
                return 0
              }
              return 0
            })
          }}
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-line-strong" />
        </div>

        {title && (
          <header className="flex-none px-5 pb-3">
            <h3 className="text-base font-bold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] text-fg-mute">{subtitle}</p>}
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <footer className="pb-safe flex-none border-t border-line bg-ink-750/60 px-5 pt-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Make `Modal` responsive**

In `src/components/ui.tsx`, add the imports and rewrite the body of `Modal` (keep the exported name
and props identical so no call site changes):

```tsx
import { Sheet } from './ui/Sheet'
import { useIsDesktop } from '@/hooks/useMediaQuery'
```

```tsx
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!open || !isDesktop) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose, isDesktop])

  if (!open) return null

  if (!isDesktop)
    return (
      <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer}>
        {children}
      </Sheet>
    )

  // ... desktop dialog: exact markup as before, unchanged
}
```

Keep the existing desktop JSX byte-for-byte in the `isDesktop` branch.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open `http://localhost:5173/#/programari`, set the browser to 390×844,
click a calendar slot to open `QuickCreateModal`.
Expected: it slides up from the bottom, can be dismissed by dragging the handle down, the footer
buttons stay pinned above the safe area. At ≥768px it is the centred dialog as before.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Sheet primitive, Modal becomes a bottom sheet on phones"
```

---

### Task 4: Remaining UI primitives

**Files:**
- Create: `src/components/ui/SegmentedControl.tsx`, `src/components/ui/StickyBar.tsx`, `src/components/ui/Stepper.tsx`, `src/components/ui/DataList.tsx`

**Interfaces:**
- Consumes: `useIsDesktop` (Task 2), `cx` from `@/lib/utils`
- Produces:
  - `SegmentedControl<T extends string>({ options: {value: T; label: string}[], value: T, onChange: (v: T) => void })`
  - `StickyBar({ children })`
  - `Stepper({ value, onChange, step?, min?, max?, unit? })`
  - `DataList<T>({ items, getKey, columns, renderCard, onRowClick? })` where
    `columns: { key: string; header: string; cell: (item: T) => ReactNode; className?: string }[]`

- [ ] **Step 1: Implement `SegmentedControl`**

```tsx
import { cx } from '@/lib/utils'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg bg-black/[0.06] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-[36px] flex-1 rounded-[7px] px-3 text-[13px] font-semibold transition',
            value === o.value ? 'bg-ink-900 text-fg shadow-sm' : 'text-fg-mute',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement `StickyBar`**

```tsx
import type { ReactNode } from 'react'

export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe sticky bottom-0 z-30 -mx-4 flex gap-2 border-t border-line bg-ink-900/95 px-4 pt-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Implement `Stepper`**

```tsx
import { cx } from '@/lib/utils'

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const btn =
    'flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-line-strong bg-ink-800 text-lg font-bold text-fg disabled:opacity-40'

  return (
    <div className="flex items-center gap-2">
      <button className={btn} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-11 w-20 rounded-lg border border-line-strong bg-ink-750 text-center text-base font-semibold outline-none focus:border-brand-500/70"
      />
      {unit && <span className={cx('mono-label')}>{unit}</span>}
      <button className={btn} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Implement `DataList`**

```tsx
import type { ReactNode } from 'react'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { EmptyState, TableWrap, Td, Th } from '../ui'

export interface Column<T> {
  key: string
  header: string
  cell: (item: T) => ReactNode
  className?: string
}

export function DataList<T>({
  items,
  getKey,
  columns,
  renderCard,
  onRowClick,
  empty = 'Nimic de afișat.',
}: {
  items: T[]
  getKey: (item: T) => string
  columns: Column<T>[]
  renderCard: (item: T) => ReactNode
  onRowClick?: (item: T) => void
  empty?: string
}) {
  const isDesktop = useIsDesktop()

  if (items.length === 0) return <EmptyState text={empty} />

  if (isDesktop)
    return (
      <TableWrap>
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <Th key={c.key} className={c.className}>
                {c.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={getKey(item)}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? 'cursor-pointer border-b border-line hover:bg-black/[0.03]' : 'border-b border-line'}
            >
              {columns.map((c) => (
                <Td key={c.key} className={c.className}>
                  {c.cell(item)}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    )

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={getKey(item)}>
          <button
            onClick={() => onRowClick?.(item)}
            className="no-tap-highlight w-full rounded-xl border border-line bg-ink-850 p-4 text-left active:bg-black/[0.04]"
          >
            {renderCard(item)}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`
Expected: clean. (Primitives are not wired up yet — that happens in Phase 6.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add SegmentedControl, StickyBar, Stepper and DataList primitives"
```

---

## Phase 2 · Mobile shell

### Task 5: Mobile header and full-screen search

**Files:**
- Create: `src/components/mobile/MobileHeader.tsx`, `src/components/mobile/SearchOverlay.tsx`
- Modify: `src/components/AppLayout.tsx` (extract the search logic)

**Interfaces:**
- Consumes: `useStore`, `clientName`, `carName` from `@/data/store`; `LogoMark` from `@/components/Logo`
- Produces:
  - `useGlobalSearch(q: string): { label: string; sub: string; to: string }[]` — exported from `SearchOverlay.tsx`, reused by the desktop `GlobalSearch`
  - `MobileHeader({ onOpenSearch, onOpenMore })`
  - `SearchOverlay({ open, onClose })`

- [ ] **Step 1: Move the search query into a reusable hook**

In `src/components/mobile/SearchOverlay.tsx` export:

```tsx
export function useGlobalSearch(q: string) {
  const { clients, cars, jobs } = useStore()
  return useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const out: { label: string; sub: string; to: string }[] = []
    clients.forEach((c) => {
      const name = clientName(c)
      if ([name, c.phone, c.vatId, c.cnp].join(' ').toLowerCase().includes(s))
        out.push({ label: name, sub: c.phone || 'client', to: `/clienti/${c.id}` })
    })
    cars.forEach((c) => {
      if ([carName(c), c.plate, c.vin].join(' ').toLowerCase().includes(s))
        out.push({ label: carName(c), sub: c.plate, to: `/masini/${c.id}` })
    })
    jobs.forEach((j) => {
      if (j.code.toLowerCase().includes(s))
        out.push({ label: j.code, sub: 'programare', to: `/programari/${j.id}` })
    })
    return out.slice(0, 12)
  }, [q, clients, cars, jobs])
}
```

Then update the desktop `GlobalSearch` in `AppLayout.tsx` to call `useGlobalSearch(q)` instead of its
inline `useMemo`, deleting the duplicated block.

- [ ] **Step 2: Implement `SearchOverlay`**

Full-screen, `fixed inset-0 z-50 bg-ink-900`, header row with a back arrow and an autofocused input
(`h-11`), results as a list of 56px rows. Selecting a result calls `navigate(to)` then `onClose()`.

```tsx
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const nav = useNavigate()
  const results = useGlobalSearch(q)

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-900">
      <div className="pt-safe flex flex-none items-center gap-2 border-b border-line px-3 py-2">
        <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-fg-mute">
          <IconChevronLeft width={20} height={20} />
        </button>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Client, mașină, nr. înmatriculare, PRG-…"
          className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-ink-750 px-3 text-base outline-none focus:border-brand-500/60"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {results.map((r) => (
          <button
            key={r.to + r.label}
            onClick={() => {
              nav(r.to)
              onClose()
            }}
            className="flex min-h-[56px] w-full items-center justify-between gap-3 border-b border-line px-4 text-left"
          >
            <span className="truncate text-sm font-semibold">{r.label}</span>
            <span className="font-mono text-[11px] text-fg-faint">{r.sub}</span>
          </button>
        ))}
        {q.trim().length >= 2 && results.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-fg-mute">Niciun rezultat.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement `MobileHeader`**

56px tall, `sticky top-0 z-30`, `pt-safe`, border-bottom. Left: `LogoMark size={28}` + wordmark.
Right: a 44px search button (`IconSearch`) and a 44px avatar button that calls `onOpenMore`.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add mobile header and full-screen search overlay"
```

---

### Task 6: Bottom tab bar, overflow sheet, FAB

**Files:**
- Create: `src/components/mobile/BottomTabBar.tsx`, `src/components/mobile/MoreSheet.tsx`, `src/components/mobile/Fab.tsx`

**Interfaces:**
- Consumes: `Sheet` (Task 3); `canSeeTimeOff`, `canEditSettings`, `useCurrentUser`, `useStore`, `ROLE_LABEL` from `@/data/store`
- Produces:
  - `BottomTabBar({ onOpenMore })`
  - `MoreSheet({ open, onClose })`
  - `Fab({ onClick, label })`

- [ ] **Step 1: Implement `BottomTabBar`**

Five items — `/azi` (Azi, `IconDashboard`), `/programari` (Calendar, `IconCalendar`),
`/clienti` (Clienți, `IconUsers`), `/stoc` (Stoc, `IconBox`), plus a "Mai multe" button
(`IconSettings`) that calls `onOpenMore`.

```tsx
export function BottomTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const pending = useStore(
    (s) => s.notifications.filter((n) => n.status === 'programata' && new Date(n.dueAt) <= new Date()).length,
  )
  const item =
    'no-tap-highlight flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold'

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-ink-900/95 backdrop-blur md:hidden">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/azi'}
          className={({ isActive }) => cx(item, isActive ? 'text-brand-500' : 'text-fg-mute')}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
      <button onClick={onOpenMore} className={cx(item, 'relative text-fg-mute')}>
        <IconSettings />
        Mai multe
        {pending > 0 && (
          <span className="absolute top-2 right-1/4 h-2 w-2 rounded-full bg-ember" />
        )}
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: Implement `MoreSheet`**

A `Sheet` containing, in order: the current user (avatar, name, `ROLE_LABEL`) with the staff
`<select>` moved here; a link list — Mașini, Notificări (with the pending count badge),
Concedii (only if `canSeeTimeOff(me?.role)`), Rapoarte, Setări (only if `canEditSettings(me?.role)`),
Dashboard; then "Instalează aplicația" (wired in Task 10); then "Resetează demo" with the existing
`confirm()` guard. Every row is at least 52px tall. Selecting a link navigates and closes the sheet.

- [ ] **Step 3: Implement `Fab`**

```tsx
export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-xl active:brightness-110 md:hidden"
    >
      <IconPlus width={24} height={24} />
    </button>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add bottom tab bar, more sheet and floating action button"
```

---

### Task 7: Responsive AppLayout

**Files:**
- Modify: `src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `MobileHeader`, `SearchOverlay` (Task 5), `BottomTabBar`, `MoreSheet`, `Fab` (Task 6), `useIsDesktop` (Task 2)
- Produces: a layout that renders the sidebar shell at `md` and the mobile shell below it

- [ ] **Step 1: Split the layout**

Keep the existing sidebar JSX in a `DesktopShell` component in the same file. Add:

```tsx
export default function AppLayout() {
  const isDesktop = useIsDesktop()
  const nav = useNavigate()
  const [search, setSearch] = useState(false)
  const [more, setMore] = useState(false)
  const { pathname } = useLocation()
  const showFab = pathname === '/azi' || pathname.startsWith('/programari')

  if (isDesktop) return <DesktopShell />

  return (
    <div className="flex h-dvh flex-col">
      <MobileHeader onOpenSearch={() => setSearch(true)} onOpenMore={() => setMore(true)} />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+72px)]">
        <Outlet />
      </main>
      {showFab && <Fab label="Programare nouă" onClick={() => nav('/programari/nou')} />}
      <BottomTabBar onOpenMore={() => setMore(true)} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
      <SearchOverlay open={search} onClose={() => setSearch(false)} />
      <Toasts />
    </div>
  )
}
```

- [ ] **Step 2: Fix the toast position**

Change the `Toasts` container class to
`pointer-events-none fixed top-3 right-3 left-3 z-[60] flex flex-col gap-2 md:top-auto md:right-6 md:bottom-6 md:left-auto`
so toasts do not land under the tab bar on phones.

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, browser at 390×844. Navigate through all five tabs.
Expected: no horizontal scrollbar; the tab bar never covers page content; the FAB shows only on
Azi and Programări. At 1280px the layout is byte-identical to before.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: AppLayout renders a mobile shell below the md breakpoint"
```

---

### Task 8: AziPage and role-based landing

**Files:**
- Create: `src/pages/AziPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useStore`, `useCurrentUser`, `carName`, `clientName`, `statusLabel` from `@/data/store`; `serviceDef` from `@/data/serviceCatalog`; `StatusBadge`
- Produces: route `/azi`; `<Navigate>` landing rule on `/`

- [ ] **Step 1: Implement `AziPage`**

Lists the current user's jobs for today — a job counts if `startAt`, `workStartAt` or `actualStartAt`
falls on today, and `assignee === me.name`. Owner and manager see all jobs for today. Each card shows:
time (`HH:mm`), car, plate, client, service shorts, `StatusBadge`. Primary action button, 44px tall:

- status `programat` → **▶ Începe** — `updateJob(id, { status: 'in_lucru', actualStartAt: new Date().toISOString() })`
- status `in_lucru` → **■ Finalizează** — `updateJob(id, { status: 'finalizat', actualEndAt: new Date().toISOString(), completedAt: new Date().toISOString() })`
- otherwise no button

Tapping the card body navigates to `/programari/:id`. Empty state: „Nicio lucrare pentru azi."

Check the existing job-completion path in `JobDetailPage.tsx` before writing the handlers — if
finishing a job there also schedules the retouch notification, call that same store action instead
of patching the fields directly, so the notification queue keeps working.

- [ ] **Step 2: Wire the route and the landing rule**

In `src/App.tsx` add `<Route path="azi" element={<AziPage />} />` and replace the index route:

```tsx
<Route index element={<Landing />} />
```

```tsx
function Landing() {
  const me = useCurrentUser()
  const isDesktop = useIsDesktop()
  if (isDesktop) return <DashboardPage />
  return <Navigate to={canSeeTimeOff(me?.role) ? '/programari' : '/azi'} replace />
}
```

`canSeeTimeOff` is already the owner-or-manager predicate, so it doubles as the manager check here.

- [ ] **Step 3: Verify visually**

Run: `npm run dev` at 390×844. Switch the user to Robert (operator) via the More sheet.
Expected: landing on `/azi` with only Robert's jobs; switching to Andrei (owner) lands on the calendar.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Azi page and role-based mobile landing"
```

---

## Phase 3 · PWA

### Task 9: Web app manifest

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`
- Modify: `index.html`

**Interfaces:**
- Consumes: `src/assets/custom-tuning-logo.png` as the icon source
- Produces: an installable manifest at `./manifest.webmanifest`

- [ ] **Step 1: Generate the icons**

Produce three PNGs from the brand logo on a white background, centred with ~12% padding:
192×192, 512×512, and 180×180 (`apple-touch-icon.png`). Use `sips` (macOS, already available):

```bash
mkdir -p public/icons
sips -s format png -z 192 192 src/assets/custom-tuning-logo.png --out public/icons/icon-192.png
sips -s format png -z 512 512 src/assets/custom-tuning-logo.png --out public/icons/icon-512.png
sips -s format png -z 180 180 src/assets/custom-tuning-logo.png --out public/icons/apple-touch-icon.png
```

- [ ] **Step 2: Write the manifest**

`public/manifest.webmanifest` — paths are relative because `vite.config.ts` sets `base: './'`:

```json
{
  "name": "Custom Tuning · Atelier",
  "short_name": "Custom Tuning",
  "description": "Programări, lucrări și stoc pentru atelierul Custom Tuning.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#e02a2a",
  "lang": "ro",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Link it from `index.html`**

Inside `<head>`, after the existing `theme-color` meta:

```html
<link rel="manifest" href="./manifest.webmanifest" />
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Custom Tuning" />
```

Also change the existing `<link rel="icon" href="/favicon.png">` to `./favicon.png` — the absolute
path breaks under `base: './'` when the app is served from a subdirectory.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run preview`, open the preview URL in Chrome, DevTools → Application → Manifest.
Expected: no errors, "Installable" with no warnings, all three icons resolve.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add web app manifest and icons"
```

---

### Task 10: Install prompt

**Files:**
- Create: `src/hooks/useInstallPrompt.ts`, `src/hooks/useInstallPrompt.test.ts`, `src/components/mobile/InstallPrompt.tsx`
- Modify: `src/components/AppLayout.tsx`, `src/components/mobile/MoreSheet.tsx`

**Interfaces:**
- Consumes: `Sheet` (Task 3), `useIsDesktop` (Task 2)
- Produces:

```ts
export type InstallPlatform = 'android' | 'ios' | 'none'
export interface InstallState {
  platform: InstallPlatform
  /** true = merită afișat sheet-ul acum */
  shouldPrompt: boolean
  /** deschide dialogul nativ (Android). Rezolvă false pe iOS. */
  install: () => Promise<boolean>
  /** amână 14 zile */
  snooze: () => void
  /** deschide manual din meniu, ocolind regulile de temporizare */
  openManually: () => void
  manualOpen: boolean
  closeManual: () => void
}
export function useInstallPrompt(): InstallState
```

Display rules (from the spec): never when already installed (`display-mode: standalone` or
`navigator.standalone`), never at `md` and above, only from the second visit, and only after 30
seconds of use. `snooze()` writes `ct.install.snoozeUntil` (epoch ms, now + 14 days) to localStorage;
a successful install writes `ct.install.done = '1'`, which suppresses it permanently. Visit count
lives in `ct.install.visits`.

- [ ] **Step 1: Write the failing test**

`src/hooks/useInstallPrompt.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { shouldShowInstall } from './useInstallPrompt'

const DAY = 86_400_000

describe('shouldShowInstall', () => {
  beforeEach(() => localStorage.clear())

  it('nu apare la prima vizită', () => {
    expect(shouldShowInstall({ visits: 1, now: 0, installed: false, desktop: false })).toBe(false)
  })

  it('apare de la a doua vizită', () => {
    expect(shouldShowInstall({ visits: 2, now: 0, installed: false, desktop: false })).toBe(true)
  })

  it('nu apare dacă e deja instalată', () => {
    expect(shouldShowInstall({ visits: 5, now: 0, installed: true, desktop: false })).toBe(false)
  })

  it('nu apare pe desktop', () => {
    expect(shouldShowInstall({ visits: 5, now: 0, installed: false, desktop: true })).toBe(false)
  })

  it('tace 14 zile după amânare', () => {
    localStorage.setItem('ct.install.snoozeUntil', String(10 * DAY))
    expect(shouldShowInstall({ visits: 5, now: 5 * DAY, installed: false, desktop: false })).toBe(false)
    expect(shouldShowInstall({ visits: 5, now: 11 * DAY, installed: false, desktop: false })).toBe(true)
  })

  it('tace definitiv după instalare', () => {
    localStorage.setItem('ct.install.done', '1')
    expect(shouldShowInstall({ visits: 9, now: 99 * DAY, installed: false, desktop: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/hooks/useInstallPrompt.test.ts`
Expected: FAIL — `shouldShowInstall` is not exported.

- [ ] **Step 3: Implement the hook**

Export the pure predicate exactly as tested:

```ts
export function shouldShowInstall(o: {
  visits: number
  now: number
  installed: boolean
  desktop: boolean
}): boolean {
  if (o.installed || o.desktop) return false
  if (o.visits < 2) return false
  if (localStorage.getItem('ct.install.done') === '1') return false
  const until = Number(localStorage.getItem('ct.install.snoozeUntil') ?? 0)
  return o.now >= until
}
```

Around it, the hook: capture `beforeinstallprompt` (`e.preventDefault()`, store the event),
detect iOS via `/iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)`,
detect installed via `window.matchMedia('(display-mode: standalone)').matches ||
(navigator as { standalone?: boolean }).standalone === true`, bump the visit counter once on mount,
and flip `shouldPrompt` to true after a 30-second timer if `shouldShowInstall(...)` holds.
`platform` is `'android'` when a deferred event exists, `'ios'` when iOS and not installed,
`'none'` otherwise. `install()` calls `prompt()` on the deferred event, awaits `userChoice`, writes
`ct.install.done` on `'accepted'`, and returns the boolean.

Type the deferred event locally — it is not in lib.dom:

```ts
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/hooks/useInstallPrompt.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Implement `InstallPrompt`**

A `Sheet` with `LogoMark size={48}`, the heading „Adaugă Custom Tuning pe ecranul principal" and the
line „Se deschide ca o aplicație, fără bara de browser."

- `platform === 'android'`: footer with **Instalează** (primary, calls `install()`) and **Mai târziu** (calls `snooze()`).
- `platform === 'ios'`: an ordered list — „1. Apasă butonul Partajare din bara Safari. 2. Alege «Adaugă la ecranul principal». 3. Confirmă cu «Adaugă»." — plus a single **Am înțeles** button that calls `snooze()`.

- [ ] **Step 6: Mount it and add the manual entry**

In `AppLayout`'s mobile branch, render `<InstallPrompt />` next to `<MoreSheet />`. In `MoreSheet`,
add the row „Instalează aplicația" that calls `openManually()`; hide the row when
`platform === 'none'`.

- [ ] **Step 7: Verify visually**

Run: `npm run build && npm run preview` in Chrome at 390×844 with device emulation. Clear localStorage,
reload twice, wait 30s.
Expected: the sheet appears once; "Mai târziu" hides it and it does not return on reload; the
"Instalează aplicația" row in More still opens it.

- [ ] **Step 8: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add PWA install prompt with Android and iOS paths"
```

---

## Phase 4 · Calendar core

### Task 11: Calendar geometry

**Files:**
- Create: `src/components/calendar/layout.ts`, `src/components/calendar/layout.test.ts`

**Interfaces:**
- Consumes: nothing (no React, no date-fns — pure numbers)
- Produces:

```ts
export interface Interval { id: string; startMin: number; endMin: number }
export interface Placed extends Interval { col: number; cols: number }
export function layoutDay(items: Interval[]): Placed[]
export function snapMinutes(min: number, step?: number): number
export function minutesFromY(y: number, pxPerMin: number, dayStartMin: number): number
export function yFromMinutes(min: number, pxPerMin: number, dayStartMin: number): number
export function autoScrollSpeed(pointerY: number, top: number, height: number): number

export interface DayDensity { tones: string[]; total: number }
export function dayDensity(tones: string[]): DayDensity
```

`DAY_START_MIN = 7 * 60`, `DAY_END_MIN = 21 * 60`, `SNAP_MIN = 15`, `MIN_BLOCK_MIN = 20`,
`MAX_DENSITY_DOTS = 4` are exported constants.

`dayDensity` takes one tone key per job in the day, in chronological order, and returns the
distinct tones in first-seen order (capped at `MAX_DENSITY_DOTS`) plus the untruncated total.
It stays free of domain types — the caller maps `Job.status` to a tone through `STATUS_TONE`.

- [x] **Step 1: Write the failing tests**

`src/components/calendar/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { autoScrollSpeed, dayDensity, layoutDay, minutesFromY, snapMinutes, yFromMinutes } from './layout'

describe('layoutDay', () => {
  it('pune evenimentele care nu se suprapun pe o singură coloană', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 600 },
      { id: 'b', startMin: 600, endMin: 660 },
    ])
    expect(out.map((p) => [p.id, p.col, p.cols])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ])
  })

  it('împarte două evenimente suprapuse în două coloane', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 660 },
      { id: 'b', startMin: 570, endMin: 630 },
    ])
    expect(out.find((p) => p.id === 'a')).toMatchObject({ col: 0, cols: 2 })
    expect(out.find((p) => p.id === 'b')).toMatchObject({ col: 1, cols: 2 })
  })

  it('refolosește o coloană eliberată în același cluster', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 720 },
      { id: 'b', startMin: 550, endMin: 600 },
      { id: 'c', startMin: 610, endMin: 660 },
    ])
    expect(out.find((p) => p.id === 'c')).toMatchObject({ col: 1, cols: 2 })
  })

  it('nu amestecă două clustere separate', () => {
    const out = layoutDay([
      { id: 'a', startMin: 540, endMin: 600 },
      { id: 'b', startMin: 545, endMin: 600 },
      { id: 'c', startMin: 700, endMin: 760 },
    ])
    expect(out.find((p) => p.id === 'c')).toMatchObject({ col: 0, cols: 1 })
  })
})

describe('snapMinutes', () => {
  it('rotunjește la sfertul de oră cel mai apropiat', () => {
    expect(snapMinutes(547)).toBe(540)
    expect(snapMinutes(553)).toBe(555)
  })
})

describe('minutesFromY / yFromMinutes', () => {
  it('sunt inverse', () => {
    const px = 1.2
    expect(minutesFromY(yFromMinutes(600, px, 420), px, 420)).toBeCloseTo(600)
  })
})

describe('autoScrollSpeed', () => {
  it('e zero în zona centrală', () => {
    expect(autoScrollSpeed(400, 0, 800)).toBe(0)
  })

  it('e negativ lângă marginea de sus și pozitiv lângă cea de jos', () => {
    expect(autoScrollSpeed(10, 0, 800)).toBeLessThan(0)
    expect(autoScrollSpeed(795, 0, 800)).toBeGreaterThan(0)
  })

  it('crește cu adâncimea în zonă', () => {
    expect(Math.abs(autoScrollSpeed(0, 0, 800))).toBeGreaterThan(Math.abs(autoScrollSpeed(100, 0, 800)))
  })
})

describe('dayDensity', () => {
  it('o zi goală nu are nici puncte, nici total', () => {
    expect(dayDensity([])).toEqual({ tones: [], total: 0 })
  })

  it('păstrează un singur punct per status distinct', () => {
    expect(dayDensity(['brand', 'brand', 'mint'])).toEqual({ tones: ['brand', 'mint'], total: 3 })
  })

  it('păstrează ordinea primei apariții', () => {
    expect(dayDensity(['mint', 'brand', 'mint']).tones).toEqual(['mint', 'brand'])
  })

  it('taie punctele la patru, dar nu totalul', () => {
    const out = dayDensity(['a', 'b', 'c', 'd', 'e', 'a', 'b'])
    expect(out.tones).toEqual(['a', 'b', 'c', 'd'])
    expect(out.total).toBe(7)
  })
})
```

- [x] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/calendar/layout.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `layout.ts`**

```ts
export const DAY_START_MIN = 7 * 60
export const DAY_END_MIN = 21 * 60
export const SNAP_MIN = 15
export const MIN_BLOCK_MIN = 20
export const MAX_DENSITY_DOTS = 4
const SCROLL_ZONE = 0.15
const MAX_SCROLL_PX = 14

export interface Interval {
  id: string
  startMin: number
  endMin: number
}

export interface Placed extends Interval {
  col: number
  cols: number
}

/**
 * Împarte evenimentele unei zile pe coloane paralele.
 * Sortare după start → clustere de suprapunere → prima coloană liberă.
 */
export function layoutDay(items: Interval[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const out: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -Infinity
  let colEnds: number[] = []

  const flush = () => {
    const cols = colEnds.length || 1
    cluster.forEach((p) => out.push({ ...p, cols }))
    cluster = []
    colEnds = []
    clusterEnd = -Infinity
  }

  for (const it of sorted) {
    if (it.startMin >= clusterEnd) flush()
    let col = colEnds.findIndex((end) => end <= it.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(it.endMin)
    } else {
      colEnds[col] = it.endMin
    }
    cluster.push({ ...it, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  flush()

  return out.sort((a, b) => a.startMin - b.startMin || a.col - b.col)
}

export const snapMinutes = (min: number, step = SNAP_MIN) => Math.round(min / step) * step

export const minutesFromY = (y: number, pxPerMin: number, dayStartMin = DAY_START_MIN) =>
  dayStartMin + y / pxPerMin

export const yFromMinutes = (min: number, pxPerMin: number, dayStartMin = DAY_START_MIN) =>
  (min - dayStartMin) * pxPerMin

/**
 * Viteza de auto-scroll în px/cadru, când degetul intră în ultimele 15%
 * din înălțimea vizibilă. Negativ = în sus.
 */
export function autoScrollSpeed(pointerY: number, top: number, height: number): number {
  const zone = height * SCROLL_ZONE
  const rel = pointerY - top
  if (rel < zone) return -MAX_SCROLL_PX * Math.min(1, (zone - rel) / zone)
  if (rel > height - zone) return MAX_SCROLL_PX * Math.min(1, (rel - (height - zone)) / zone)
  return 0
}

export interface DayDensity {
  tones: string[]
  total: number
}

/**
 * Rezumatul unei zile pentru celula de lună: câte un punct per status distinct,
 * cel mult patru, plus totalul netăiat al lucrărilor.
 */
export function dayDensity(tones: string[]): DayDensity {
  return {
    tones: [...new Set(tones)].slice(0, MAX_DENSITY_DOTS),
    total: tones.length,
  }
}
```

- [x] **Step 4: Run the tests**

Run: `npm test -- src/components/calendar/layout.test.ts`
Expected: PASS (13 tests).

- [x] **Step 5: Verify**

Run: `npx tsc -b && npm run lint`

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add pure calendar geometry with unit tests"
```

---

### Task 12: Single source of calendar events

**Files:**
- Create: `src/components/calendar/useCalendarEvents.ts`, `src/components/calendar/useCalendarEvents.test.tsx`, `src/components/calendar/fullCalendarAdapter.ts`
- Move: `src/components/JobCalendar.tsx` → `src/components/calendar/JobCalendar.tsx`
- Modify: `src/pages/JobsPage.tsx` (import path)

**Interfaces:**
- Consumes: `layout.ts` constants (Task 11); `useStore`, `canSeeTimeOff`, `carName`, `clientName`, `TIME_OFF_COLOR`, `TIME_OFF_LABEL`, `useCurrentUser` from `@/data/store`; `STATUS_TONE` from `@/components/StatusBadge`; `serviceDef` from `@/data/serviceCatalog`
- Produces:

```ts
export type CalEventKind = 'primire' | 'executie' | 'timeoff'
/** `concedii` is a layer too — `JobCalendar` already toggles all three today */
export type Layer = 'primire' | 'executie' | 'concedii'

export interface CalEvent {
  /** unic în calendar: jobId, `${jobId}::work` sau `off-${id}` */
  id: string
  jobId: string | null
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

export interface CalFilters { layers: Layer[]; who: string }

export function useCalendarEvents(jobs: Job[], filters: CalFilters): CalEvent[]
export function toFullCalendarEvents(events: CalEvent[]): EventInput[]  // fullCalendarAdapter.ts
```

`who === 'toti'` means no operator filter. Time-off events need both the `concedii` layer on *and* a
current user passing `canSeeTimeOff` — the role check is not a substitute for the toggle. They are
never editable.

- [x] **Step 1: Write the failing test**

`src/components/calendar/useCalendarEvents.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCalendarEvents } from './useCalendarEvents'
import { useStore } from '@/data/store'
import type { Job } from '@/data/types'

const job = (over: Partial<Job>): Job =>
  ({
    id: 'j1',
    code: 'PRG-1',
    clientId: '',
    carId: '',
    status: 'programat',
    startAt: '2026-08-03T09:00:00.000Z',
    durationMin: 30,
    workStartAt: '2026-08-03T10:00:00.000Z',
    workEndAt: '2026-08-03T13:00:00.000Z',
    estimateMin: 180,
    estimateManual: false,
    actualStartAt: null,
    actualEndAt: null,
    deliveryAt: null,
    assignee: 'Robert',
    notes: '',
    services: [],
    photos: [],
    events: [],
    trackingToken: 't',
    createdAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    ...over,
  }) as Job

describe('useCalendarEvents', () => {
  it('produce un eveniment de primire și unul de execuție', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({})], { layers: ['primire', 'executie'], who: 'toti' }),
    )
    const kinds = result.current.filter((e) => e.kind !== 'timeoff').map((e) => e.kind)
    expect(kinds).toEqual(['primire', 'executie'])
  })

  it('ascunde stratul dezactivat', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({})], { layers: ['primire'], who: 'toti' }),
    )
    expect(result.current.some((e) => e.kind === 'executie')).toBe(false)
  })

  it('filtrează după operator', () => {
    const { result } = renderHook(() =>
      useCalendarEvents([job({})], { layers: ['primire', 'executie'], who: 'Daniel' }),
    )
    expect(result.current.filter((e) => e.kind !== 'timeoff')).toHaveLength(0)
  })

  it('nu produce concedii pentru operator', () => {
    const operator = useStore.getState().staff.find((s) => s.role === 'operator')!
    useStore.getState().setCurrentUser(operator.id)
    const { result } = renderHook(() =>
      useCalendarEvents([], { layers: ['primire', 'executie'], who: 'toti' }),
    )
    expect(result.current.some((e) => e.kind === 'timeoff')).toBe(false)
  })
})
```

- [x] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/components/calendar/useCalendarEvents.test.tsx`
Expected: FAIL — module not found.

- [x] **Step 3: Extract the hook**

Move the `events` `useMemo` body out of `JobCalendar.tsx` into `useCalendarEvents.ts`, producing
`CalEvent` objects (plain `Date`s, no FullCalendar shapes). Keep the existing colour rules:
`TONE_HEX[STATUS_TONE[job.status]]` for jobs, `TIME_OFF_COLOR[t.type]` for time off. Move `TONE_HEX`
here and export it.

- [x] **Step 4: Write the FullCalendar adapter**

`fullCalendarAdapter.ts` maps `CalEvent[]` to the exact `EventInput[]` shape `JobCalendar` produces
today — white background with coloured border and class `ct-ev-primire` for primire,
`${color}26` background with class `ct-ev-executie` for execuție, all-day block styling for time off —
so the desktop calendar renders identically.

- [x] **Step 5: Rewire `JobCalendar`**

Move the file to `src/components/calendar/JobCalendar.tsx`. Replace its inline `events` memo with:

```tsx
const calEvents = useCalendarEvents(jobs, { layers, who })
const events = useMemo(() => toFullCalendarEvents(calEvents), [calEvents])
```

Fix the import in `src/pages/JobsPage.tsx`.

- [x] **Step 6: Run the tests**

Run: `npm test`
Expected: all pass, including the 4 new ones.

- [x] **Step 7: Verify visually**

Run: `npm run dev` at 1440×900, open Programări.
Expected: the desktop calendar is unchanged — same colours, same PRIM/EXEC labels, drag and resize
still write to the store.

- [x] **Step 8: Verify**

Run: `npx tsc -b && npm run lint`

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: extract useCalendarEvents as the single calendar data source"
```

---

### Task 13: Long-press drag hook

**Files:**
- Create: `src/components/calendar/useLongPressDrag.ts`

**Interfaces:**
- Consumes: `layout.ts` (Task 11), `useHaptics` (Task 2)
- Produces:

```ts
export interface DragState {
  id: string
  /** minute față de poziția inițială, deja rotunjite la 15 */
  deltaMin: number
  /** ce se mută: tot blocul, marginea de sus, marginea de jos */
  edge: 'move' | 'start' | 'end'
  /** offset în coloane de zi (doar view-ul 3 zile) */
  deltaDays: number
}

export function useLongPressDrag(opts: {
  scrollRef: React.RefObject<HTMLElement | null>
  pxPerMin: number
  /** lățimea unei coloane de zi, 0 dacă view-ul are o singură zi */
  colWidth: number
  onCommit: (s: DragState) => void
  holdMs?: number
}): {
  drag: DragState | null
  bind: (id: string, edge?: 'move' | 'start' | 'end') => {
    onPointerDown: (e: React.PointerEvent) => void
  }
}
```

Behaviour: on `pointerdown`, start a `holdMs` (default 400) timer; if the pointer moves more than
8px before it fires, cancel — that gesture belongs to the scroll container. When it fires, call
`haptics.tap()` and set `drag` with `deltaMin: 0`. While dragging, update `deltaMin` from the pointer
delta via `snapMinutes(rawDelta)` and `deltaDays` from `Math.round(dx / colWidth)` when
`colWidth > 0`. Run a `requestAnimationFrame` loop that adds `autoScrollSpeed(...)` to
`scrollRef.current.scrollTop` while non-zero, and folds the scrolled distance into `deltaMin` so the
block tracks the finger. On `pointerup`, call `onCommit(drag)` and clear. On `pointercancel` or
`Escape`, clear without committing.

- [x] **Step 1: Implement the hook**

Use `setPointerCapture` on the target so the gesture survives leaving the element. Keep mutable
values (`startY`, `startX`, `rafId`, `scrolled`) in refs; only `drag` is state.

- [x] **Step 2: Verify**

Run: `npx tsc -b && npm run lint`
Expected: clean. (Exercised in Task 16.)

- [x] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add long-press drag hook with snap and auto-scroll"
```

---

## Phase 5 · Mobile calendar

### Task 14: Swipe pager

**Files:**
- Create: `src/components/calendar/CalendarPager.tsx`

**Interfaces:**
- Consumes: nothing beyond React
- Produces:

```tsx
export type PagerStep = { unit: 'days'; count: number } | { unit: 'month' }

export function CalendarPager({
  anchor,           // Date — începutul perioadei curente
  step,             // o zi, trei zile, sau o lună
  onAnchorChange,   // (d: Date) => void
  render,           // (start: Date) => ReactNode
}: { anchor: Date; step: PagerStep; onAnchorChange: (d: Date) => void; render: (start: Date) => ReactNode }): ReactElement

export const shiftAnchor = (anchor: Date, step: PagerStep, dir: -1 | 1): Date
```

Renders three pages — previous, current, next — in a `flex` row translated by `-100%`. A horizontal
drag over 60px, or a flick faster than 0.4 px/ms, animates to the neighbouring page and calls
`onAnchorChange(shiftAnchor(anchor, step, ±1))`; anything less springs back. `touch-action: pan-y` so
vertical scrolling inside a page still works.

`shiftAnchor` is `addDays(anchor, count * dir)` for `days` and `startOfMonth(addMonths(anchor, dir))`
for `month` — month steps must not drift when the anchor sits on the 31st.

- [x] **Step 1: Implement the pager**

Track `dx` in state, `startX`/`startT` in refs. Only claim the gesture once `|dx| > |dy|` and
`|dx| > 10`, so a vertical scroll in the time grid is never hijacked.

- [x] **Step 2: Verify**

Run: `npx tsc -b && npm run lint`

- [x] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add swipe pager for calendar periods"
```

---

### Task 15: Time grid view

**Files:**
- Create: `src/components/calendar/TimeGridView.tsx`

**Interfaces:**
- Consumes: `layout.ts` (Task 11), `CalEvent` (Task 12)
- Produces:

```tsx
export function TimeGridView({
  start,      // prima zi afișată
  days,       // 1 sau 3
  events,     // CalEvent[] deja filtrate
  onEventTap, // (e: CalEvent) => void
  onEmptyLongPress, // (start: Date) => void
  scrollRef,
}: TimeGridProps): ReactElement
```

Layout: a 52px hour gutter plus `days` equal columns. `PX_PER_MIN = 1.1` → 07:00–21:00 is 924px, so
the grid scrolls vertically inside its own container. Half-hour lines are `border-line`, hour lines
`border-line-strong`. The now-indicator is a 2px `brand-500` line with a 8px dot at the left, rendered
only when today is visible, positioned via `yFromMinutes` and re-rendered on a 60s interval.

Events: per column, build `Interval[]` from the events whose start falls on that day, clamping
duration to `MIN_BLOCK_MIN`, run `layoutDay`, then position each block absolutely at
`top: yFromMinutes(startMin)`, `height: (endMin - startMin) * PX_PER_MIN`,
`left: col / cols * 100%`, `width: 1 / cols * 100%` minus a 2px gutter.

Block styling mirrors the desktop: primire = white fill, 2px coloured left border, dotted outline,
label `PRIM`; execuție = `${color}26` fill, solid coloured left border, label `EXEC`. Both show
`HH:mm` + car on line one and client · services on line two, truncated.

- [x] **Step 1: Implement the grid, hour gutter and now-indicator**
- [x] **Step 2: Implement event positioning via `layoutDay`**
- [x] **Step 3: Wire `onEventTap` and long-press on empty space**

For empty space, attach a 400ms press timer on the column background; on fire, compute
`snapMinutes(minutesFromY(offsetY, PX_PER_MIN))` and call `onEmptyLongPress` with that `Date`.

- [x] **Step 4: Verify visually**

Temporarily render `<TimeGridView>` from `JobsPage` below the existing calendar at 390×844.
Expected: correct hour alignment, overlapping jobs side by side, the now-line at the right height.
Remove the temporary mount before committing.

- [x] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add mobile time grid view"
```

---

### Task 16: Drag, resize and create in the time grid

> Implemented together with Task 15 in one commit — splitting them would have left
> three unused props on `TimeGridView` for a whole commit.

**Files:**
- Modify: `src/components/calendar/TimeGridView.tsx`

**Interfaces:**
- Consumes: `useLongPressDrag` (Task 13)
- Produces: `TimeGridView` gains `onMove: (e: CalEvent, deltaMin: number, deltaDays: number, edge: 'move' | 'start' | 'end') => void`

- [x] **Step 1: Bind the drag hook to event blocks**

Call `bind(event.id)` on the block, `bind(event.id, 'start')` / `bind(event.id, 'end')` on two 44px
resize handles that render only while that block is the active drag target. Blocks carry
`touch-action: none`; time-off blocks are not bound (`editable === false`).

- [x] **Step 2: Render the lifted state and the time badge**

While `drag?.id === event.id`, apply `scale-[1.03]`, `shadow-xl`, `z-20`, and render a badge pinned to
the block showing the prospective time, e.g. `10:45 – 13:45`, computed from the event start plus
`drag.deltaMin`.

- [x] **Step 3: Commit the move**

On `onCommit`, call `onMove(...)`. In the parent (`MobileCalendar`, Task 19) that maps to the same
store writes the desktop calendar performs:

- `kind === 'primire'`, `edge === 'move'` → `updateJob(jobId, { startAt })`
- `kind === 'primire'`, `edge === 'end'` → `updateJob(jobId, { durationMin })`
- `kind === 'executie'`, `edge === 'move'` → `updateJob(jobId, { workStartAt, workEndAt })`
- `kind === 'executie'`, `edge === 'start' | 'end'` → `updateJob(jobId, { workStartAt, workEndAt, estimateMin, estimateManual: true })`

Each write is followed by the same toast text the desktop uses.

- [x] **Step 4: Verify visually**

Run: `npm run dev` at 390×844 with touch emulation on.
Expected: press-and-hold lifts a block after ~400ms; dragging it to the top edge scrolls the grid;
the badge tracks the finger in 15-minute steps; releasing moves the job and shows a toast; a short
tap opens the event sheet instead; a plain vertical swipe still scrolls the grid.

- [x] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: long-press drag, resize and create in the mobile time grid"
```

---

### Task 17: Agenda view

**Files:**
- Create: `src/components/calendar/AgendaView.tsx`

**Interfaces:**
- Consumes: `CalEvent` (Task 12)
- Produces: `AgendaView({ start, days, events, onEventTap })` — `days` defaults to 14

- [ ] **Step 1: Implement it**

Group events by day key (`yyyy-MM-dd`) over `days` days from `start`. Each day gets a sticky header
(`sticky top-0 z-10 bg-ink-900/95 backdrop-blur`) showing the weekday and date in Romanian
(`format(d, 'EEEE, d MMMM', { locale: ro })`), with today marked by a `brand-500` dot. Rows are
56px minimum: a time column (`HH:mm`, or `PRIM`/`EXEC` label), a colour bar, then car · client ·
services. Days with nothing show a muted „nimic programat" line — they are not skipped, so the
scroll keeps its rhythm.

- [ ] **Step 2: Verify visually**

Expected at 390×844: no horizontal overflow, day headers stick while scrolling, tapping a row calls
`onEventTap`.

- [ ] **Step 3: Verify**

Run: `npx tsc -b && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add agenda view for the mobile calendar"
```

---

### Task 17b: Month view

**Files:**
- Create: `src/components/calendar/MonthView.tsx`

**Interfaces:**
- Consumes: `dayDensity` + `MAX_DENSITY_DOTS` (Task 11), `CalEvent` (Task 12), `TONE_HEX`
- Produces:

```tsx
export function MonthView({
  anchor,           // orice zi din luna afișată
  events,           // CalEvent[] deja filtrate
  onPickDay,        // (d: Date) => void  — comută pe view-ul Zi
  onCreateDay,      // (d: Date) => void  — long-press pe o zi
}: MonthViewProps): ReactElement
```

The whole point of this view is orientation at a glance, so no event text is rendered — at 390px a
cell is ~55px wide and today's build truncates labels to `PRIM 0` / `Ione…`, which carries nothing.

- [ ] **Step 1: Implement the grid**

Six rows of seven, Monday-first, built from `startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })`
so the row count never changes and the grid can be a fixed `grid-rows-6` filling its container with
`h-full`. A weekday header row of 28px sits above it, outside the six rows.

Days outside the current month keep their number in `text-fg-faint` and still render density — a job
on the 31st of the previous month is real work.

- [ ] **Step 2: Implement the cell**

Bucket `events` by `format(start, 'yyyy-MM-dd')` in a `useMemo`. Per day, in chronological order,
take the tone of each **primire** and **execuție** event (`STATUS_TONE[job.status]` already carried on
`CalEvent`) and feed the array to `dayDensity`.

The cell renders, top to bottom:

1. a time-off band — a 3px full-width bar in `TIME_OFF_COLOR[type]` when an all-day event covers the
   day and the `concedii` layer is on (owner/manager only, exactly as elsewhere);
2. the day number, `text-[13px]`, `font-semibold` when it is today;
3. a row of up to `MAX_DENSITY_DOTS` dots, 6px, coloured from `TONE_HEX`;
4. the total, `font-mono text-[11px] text-fg-mute` — omitted when the day is empty.

Today's cell gets `bg-brand-500/8`. Cell borders reuse `border-line`.

- [ ] **Step 3: Wire the gestures**

`onPointerUp` under the 400ms threshold → `onPickDay(day)`. A press held past 400ms fires
`useHaptics` and `onCreateDay(day)`; the pointer must not have moved more than 10px, otherwise the
pager owns the gesture. No drag & drop here — a 55px cell offers no precise landing, and moving a job
stays in Zi / 3 zile and in `EventSheet`.

Set `touch-action: pan-x` on the grid so the pager still gets horizontal swipes.

- [ ] **Step 4: Verify visually**

Run: `npm run dev` at 390×844 and 360×800.
Expected: six rows fill the space between the top bars and the tab bar with no page scroll; a busy day
shows several dots and its total; an empty day shows only its number; tapping a day switches to Zi on
that day.

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add density-based month view for the mobile calendar"
```

---

### Task 18: Event sheet and filters sheet

**Files:**
- Create: `src/components/calendar/EventSheet.tsx`, `src/components/calendar/CalendarFilters.tsx`

**Interfaces:**
- Consumes: `Sheet` (Task 3), `Stepper` (Task 4), `CalEvent` (Task 12), `useStore`
- Produces:
  - `EventSheet({ event, onClose })` — `event: CalEvent | null`
  - `CalendarFilters({ open, onClose, value, onChange })` where
    `onChange: (f: MobileFilters) => void` and

```ts
/** starea completă a barei de filtre de pe telefon */
export interface MobileFilters extends CalFilters {
  status: JobStatus | 'toate'
  q: string
}
```

`CalFilters` (Task 12) stays `{ layers, who }` — that is all `useCalendarEvents` needs. `status` and `q`
narrow the `Job[]` *before* it reaches the hook, exactly as `JobsPage` narrows it on desktop today, so
job-level filtering never leaks into the event builder.

There is no date picker sheet: the **Lună** view covers orientation, and tapping the period label
switches to it. Building both would have meant two month grids with the same job.

- [ ] **Step 1: Implement `EventSheet`**

Header: car and plate, `StatusBadge`. Body: client with a `tel:` link, services, assignee, the
primire window and the execuție window. Actions, each 44px:

- **Deschide fișa** → `/programari/:jobId`
- **▶ Începe** when status is `programat`; **■ Finalizează** when `in_lucru` — same store writes as `AziPage` (Task 8)
- **Sună clientul** → `tel:` (hidden when the client has no phone)
- **Mută** → reveals two controls in the sheet: a `type="time"` input for the start and a `Stepper` for the duration in minutes, `step={15}`, plus a **Salvează** button writing the same fields the drag path writes

Time-off events show only a label and a link to `/concedii`.

- [ ] **Step 2: Implement `CalendarFilters`**

One `Sheet` holding everything that narrows the calendar, so nothing costs a row of screen:

- **Straturi** — toggle rows for Primire mașină / Execuție, each with the colour swatch used today,
  plus Concedii for owner/manager only (`canSeeTimeOff`).
- **Operator** — „Toți" plus every `staff` name as 44px radio rows, grouped by `position` the way the
  desktop `Select` groups them today.
- **Status** — the six filters currently living on `JobsPage` (`Toate`, `Programate`, `În lucru`,
  `Așteaptă piese`, `Finalizate`, `Predate`), each with its count.
- **Căutare** — the free-text field moved off `JobsPage`, `font-size: 16px` so iOS does not zoom.

A **Șterge filtrele** button in the footer restores
`{ layers: ['primire','executie'], who: 'toti', status: 'toate', q: '' }`. Without it, a filter left on
from yesterday reads as an empty calendar.

- [ ] **Step 3: Verify**

Run: `npx tsc -b && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add event and filters sheets for the mobile calendar"
```

---

### Task 19: MobileCalendar shell and wiring

**Files:**
- Create: `src/components/calendar/MobileCalendar.tsx`
- Modify: `src/pages/JobsPage.tsx`

**Interfaces:**
- Consumes: everything from Tasks 11–18, `useIsDesktop` (Task 2), `SegmentedControl` (Task 4), `QuickCreateModal`
- Produces: `MobileCalendar({ jobs })`; `JobsPage` picks the renderer

- [ ] **Step 1: Implement the shell**

State: `view: 'luna' | 'agenda' | 'zi' | '3zile'` (default `luna`), `anchor: Date` (default today),
`filters: MobileFilters` (default `{ layers: ['primire','executie'], who: 'toti', status: 'toate', q: '' }`),
plus open flags for the two sheets and the selected event.

`status` and `q` narrow `jobs` first — reuse the predicate `JobsPage` already applies — and the
narrowed array plus `{ layers, who }` go to `useCalendarEvents`.

The root is `flex h-full min-h-0 flex-col`; only the body scrolls.

Top bar, 2 rows, both `flex-none`:
1. 48px — `‹` · the period label (tap → switch to **Lună**) · `›` · **Azi** · a filter button carrying
   the active-filter count.
2. 36px — `SegmentedControl` with Lună / Agendă / Zi / 3 zile.

Body: `min-h-0 flex-1`, holding `CalendarPager` with
`step = { unit: 'month' } | { unit: 'days', count: 1 | 3 | 14 }`, rendering `MonthView` for luna,
`TimeGridView` for zi/3zile and `AgendaView` for agenda.

`onEmptyLongPress` opens `QuickCreateModal` with `{ kind: 'ore', startDate, startMin, durationMin: 30 }`
— the same `QuickRange` shape the desktop already uses. From `MonthView`, `onCreateDay` opens it with
`{ kind: 'zile', startDate, endDate }` instead, since a month cell carries no time. `onMove` performs
the store writes listed in Task 16 step 3.

`MonthView.onPickDay(d)` sets `anchor = d` and `view = 'zi'`.

- [ ] **Step 2: Make `JobsPage` full-bleed on mobile**

The calendar is the most-opened screen in the workshop and the hungriest for vertical space. Below
`md`, `JobsPage` drops its page chrome and fills everything between `MobileHeader` and `BottomTabBar`:

```tsx
const isDesktop = useIsDesktop()

if (!isDesktop)
  return (
    <div className="-mx-4 -mt-4 h-[calc(100%+1rem)] min-h-0">
      <MobileCalendar jobs={jobs.filter((j) => j.status !== 'anulat')} />
    </div>
  )
```

The negative margins cancel the `px-4 pt-4` that `AppLayout`'s `<main>` applies. `AppLayout` already
gives `<main>` `min-h-0 flex-1 overflow-y-auto`; change `overflow-y-auto` to `overflow-hidden` for
this route only is **not** needed — `MobileCalendar` owns its scroll and never grows past its box, so
`<main>` has nothing to scroll.

What disappears below `md`, and where it goes:

| Removed | New home |
|---|---|
| `PageHeader` title + „N din M programări" | the period label in the top bar |
| Calendar / Listă chips | the **Agendă** view is the list |
| six status chips + search input | `CalendarFilters` |
| status legend + „Următoarea: PRG-…" footer | dropped; `AziPage` covers it |

Desktop keeps every one of them, plus `JobCalendar`, untouched. Task 20 turns the desktop list view
into a `DataList`; it is out of scope here.

- [ ] **Step 3: Verify visually**

Run: `npm run dev` at 390×844 and 360×800.
Expected: **Lună** opens by default and its six rows fill the screen with no page scroll; swiping
left/right moves the period and the label follows; tapping a day lands on Zi for that day; tapping the
period label returns to Lună; the segmented control switches views without losing the anchor; the
filter button count matches the sheet; long-press on empty space opens quick-create with the tapped
time filled in; `Azi` returns to today. At 1440px the desktop `JobsPage` renders exactly as before.

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire up the mobile calendar with agenda, day and 3-day views"
```

---

## Phase 6 · Screens

### Task 20: List screens on DataList

**Files:**
- Modify: `src/pages/ClientsPage.tsx`, `src/pages/CarsPage.tsx`, `src/pages/JobsPage.tsx`, `src/pages/NotificationsPage.tsx`

**Interfaces:**
- Consumes: `DataList`, `Column` (Task 4)
- Produces: no new exports

- [ ] **Step 1: Convert `ClientsPage`**

Keep the current columns in the `columns` array. Card:

```tsx
renderCard={(c) => (
  <>
    <div className="flex items-start justify-between gap-3">
      <span className="truncate text-[15px] font-bold">{clientName(c)}</span>
      <Badge tone={c.type === 'pj' ? 'sky' : 'neutral'}>{c.type === 'pj' ? 'PJ' : 'PF'}</Badge>
    </div>
    <div className="mt-1 font-mono text-[12px] text-fg-mute">{c.phone || '—'}</div>
    <div className="mt-0.5 text-[12px] text-fg-faint">
      {carsOf(c.id).length} mașini · {jobsOf(c.id).length} lucrări
    </div>
  </>
)}
```

- [ ] **Step 2: Convert `CarsPage`**

Card: `carName(car)` bold, plate in mono below, then `{car.year || '—'} · {car.engine || '—'}` and the
owner's name in `text-fg-faint`.

- [ ] **Step 3: Convert the job list in `JobsPage`**

Card: `job.code` in mono plus `StatusBadge` on the first row; car and plate on the second;
`fmtDateTime(job.startAt)` and the assignee on the third; `fmtRon(jobTotal(job))` right-aligned.

- [ ] **Step 4: Convert `NotificationsPage`**

Card: the notification label bold, the due date below (`fmtDateTime(n.dueAt)`, in `ember` when
overdue), the client and channel on the third row, and the existing action buttons in a row at the
bottom, each 44px.

- [ ] **Step 5: Verify visually**

Expected at 360×800: no horizontal scroll on any of the four pages; each card is tappable and
navigates where the table row did. At 1440px the tables are unchanged.

- [ ] **Step 6: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: list screens render cards on phones via DataList"
```

---

### Task 21: Stock screen

**Files:**
- Modify: `src/pages/StockPage.tsx`

**Interfaces:**
- Consumes: `DataList` and `Stepper` (Task 4), `Sheet` (Task 3)

- [ ] **Step 1: Convert the item list**

Card: maker + name bold; roll number in mono; `qty` and `unit` large on the right, coloured `ember`
when `qty <= minQty`; width, finish and location as a muted third line.

- [ ] **Step 2: Move the quantity change into a sheet**

Tapping a card opens a `Sheet` titled with the item name containing a `Stepper`
(`step={item.unit === 'm' ? 0.5 : 1}`, `min={0}`), a reason input, and **Salvează**, which calls the
existing stock-movement store action. Keep the desktop inline +/− controls as they are.

- [ ] **Step 3: Convert the movements journal**

Below the items, render the journal as a plain list on phones: date in mono, delta with sign
(`mint` positive, `ember` negative), item name, author.

- [ ] **Step 4: Verify visually**

Expected at 360×800: no horizontal scroll; the stepper buttons are comfortably tappable; a change
still appears in the journal and in the dashboard low-stock alert.

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: mobile stock screen with sheet-based quantity edits"
```

---

### Task 22: Job wizard split into steps

**Files:**
- Create: `src/pages/job-new/StepClient.tsx`, `StepCar.tsx`, `StepServices.tsx`, `StepSchedule.tsx`, `useJobDraft.ts`
- Modify: `src/pages/JobNewPage.tsx`

**Interfaces:**
- Consumes: `StickyBar` (Task 4), existing `ServiceForm`, `ClientModal`, `CarModal`
- Produces: `useJobDraft()` — the draft state and the estimate calculation currently inline in `JobNewPage`, exported as a hook so each step component stays presentational

- [ ] **Step 1: Extract the draft state into `useJobDraft`**

Move the state, the auto-estimate computation and the submit handler out of `JobNewPage` unchanged.
No behaviour changes in this step — the page must still work identically on desktop after it.

- [ ] **Step 2: Split the JSX into four step components**

One file per step, each receiving the draft and its setters as props. No logic moves into them.

- [ ] **Step 3: Add the mobile stepper flow**

On phones `JobNewPage` renders one step at a time: a progress bar (`4` segments, current filled with
`brand-500`), the step title, the step body, and a `StickyBar` with **Înapoi** and
**Continuă** / **Creează programarea** on the last step. Fields stack one per row. On desktop all four
sections render on the page as they do today.

Guard forward navigation with the validation the page already performs before submit — a step
cannot be left while its required fields are empty; show the existing error text under the field.

- [ ] **Step 4: Verify visually**

Expected at 390×844: four steps, each fitting without horizontal scroll; the sticky bar stays above
the safe area with the keyboard closed; a created job appears in the calendar with the right times.
At 1440px the page is unchanged.

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: split the job wizard into steps with a mobile flow"
```

---

### Task 23: Job detail split into sections

**Files:**
- Create: `src/pages/job-detail/HeaderBar.tsx`, `SectionServices.tsx`, `SectionPhotos.tsx`, `SectionMoney.tsx`, `SectionNotifications.tsx`, `SectionHistory.tsx`, `Accordion.tsx`
- Modify: `src/pages/JobDetailPage.tsx`

**Interfaces:**
- Consumes: `Sheet` (Task 3), `StickyBar` (Task 4)
- Produces: `Accordion({ title, count?, defaultOpen?, children })`

- [ ] **Step 1: Split the file into sections**

Move each block of `JobDetailPage` into its own component with explicit props. No behaviour changes;
the desktop page must render identically after this step. Target: `JobDetailPage.tsx` under 150 lines.

- [ ] **Step 2: Add the mobile header bar**

Sticky under the app header: job code, car, `StatusBadge`, and the primary status action
(▶ Începe / ■ Finalizează / Predă) as a 44px button. The pipeline status control moves into a sheet
opened from the badge.

- [ ] **Step 3: Wrap the sections in accordions on phones**

Order: Servicii (open by default) · Bani · Poze · Notificări · Istoric. Each accordion header is 52px
and shows a count where one exists (services, photos, notifications). Desktop keeps the current
always-expanded layout.

- [ ] **Step 4: Verify visually**

Expected at 390×844: no horizontal scroll; editing a service price updates the totals; adding a photo
works; the print stylesheet still produces the same PDF sheet (`Ctrl+P` preview).

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: split job detail into sections with mobile accordions"
```

---

### Task 24: Remaining screens

**Files:**
- Modify: `src/pages/DashboardPage.tsx`, `src/pages/ReportsPage.tsx`, `src/pages/TimeOffPage.tsx`, `src/pages/SettingsPage.tsx`, `src/pages/ClientDetailPage.tsx`, `src/pages/CarDetailPage.tsx`, `src/components/PageHeader.tsx`

- [ ] **Step 1: `PageHeader`**

Stack title and actions vertically below `md`; actions become full-width 44px buttons.

- [ ] **Step 2: `DashboardPage`**

KPI grid `grid-cols-2 md:grid-cols-4`; the active-jobs and alerts lists become cards; each list is
capped at 5 entries on phones with a „Vezi toate" link.

- [ ] **Step 3: `ReportsPage`**

Each report becomes a card list on phones: label, value right-aligned in mono, and a proportional bar
(`h-1.5 rounded-full bg-brand-500/25` with an inner `bg-brand-500` at `width: pct%`). Tables stay at `md`.

- [ ] **Step 4: `TimeOffPage`**

Entries become cards (person, type badge, date range, days used, approval state). The add/edit form
moves into a `Sheet` on phones. The owner/manager guard is unchanged.

- [ ] **Step 5: `SettingsPage`**

One field per row; the VAT controls become full-width; the save button goes into a `StickyBar`.

- [ ] **Step 6: `ClientDetailPage` and `CarDetailPage`**

Header block stacks; the related lists (cars, jobs, film history) reuse `DataList` cards.

- [ ] **Step 7: Verify visually**

Expected at 360×800: no horizontal scroll on any of the six screens; every button is at least 44px.

- [ ] **Step 8: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: mobile layouts for dashboard, reports, time off, settings and detail pages"
```

---

### Task 25: Public tracking page

**Files:**
- Modify: `src/pages/TrackingPage.tsx`

This is the screen the customer opens on their own phone, so it gets a full pass rather than a shrink.

- [ ] **Step 1: Rebuild the layout mobile-first**

Single column: the workshop logo, the car and plate, a large status line, then a vertical status
timeline (`STATUS_FLOW`) with the current step marked in `brand-500` and past steps in `mint`.
Below: services performed, the estimated delivery date, and the workshop phone as a `tel:` button.
No sidebar, no app chrome — the page is outside `AppLayout` already.

- [ ] **Step 2: Verify visually**

Open `#/tracking/<token>` (any token from the seed data) at 390×844 and at 1440px.
Expected: readable without zoom, no horizontal scroll, the phone button dials.

- [ ] **Step 3: Verify**

Run: `npx tsc -b && npm run lint && npm test`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: mobile-first public tracking page"
```

---

## Phase 7 · Verification

### Task 26: Full-device verification pass

**Files:** none created; fixes land in the files they belong to.

- [ ] **Step 1: Build and lint**

```bash
npm run build && npm run lint && npm test
```

Expected: build succeeds, no lint errors, all tests pass.

- [ ] **Step 2: Serve the production build**

```bash
npm run preview
```

- [ ] **Step 3: Walk every screen at two phone sizes**

Using argent (Chromium/CDP), at **390×844** and **360×800**, screenshot each of:
Azi, Programări (lună / agendă / zi / 3 zile), Programare nouă (all four steps), Fișă programare,
Clienți, Client detaliu, Mașini, Mașină detaliu, Stoc, Notificări, Concedii, Rapoarte, Setări,
Tracking, plus the More sheet and the install prompt.

Do this twice: once as owner (Andrei), once as operator (Robert).

- [ ] **Step 4: Assert the hard rules**

For each screenshot check: no horizontal scroll, no element under the tab bar, no text truncated
mid-word, every button at least 44px. In the console, this catches overflow:

```js
[...document.querySelectorAll('*')].filter((el) => el.scrollWidth > document.documentElement.clientWidth)
```

Expected: an empty array on every screen.

On `/programari` also assert that the page itself does not scroll — the calendar owns its box:

```js
document.querySelector('main').scrollHeight <= document.querySelector('main').clientHeight
```

Expected: `true` at both sizes, in every view.

- [ ] **Step 5: Exercise the calendar gestures**

Long-press-drag a primire block to another hour, resize an execuție block, long-press empty space to
create, swipe between three consecutive days, switch views, and check the store persisted each change
by reloading the page. In **Lună**: swipe between months, tap a day and confirm it lands on Zi for that
day, tap the period label and confirm it returns to Lună, long-press a day and confirm quick-create
opens with that date.

- [ ] **Step 6: Fix what the pass found, then re-verify**

Fix in place, re-run steps 1–5 for the affected screens.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: mobile verification pass across all screens"
```

---

## Self-review notes

- **Spec coverage:** fundament → Tasks 2–4; shell → Tasks 5–8; PWA and install prompt → Tasks 9–10;
  calendar (events source, geometry, drag, views, sheets, filters, full-bleed layout) → Tasks 11–19;
  screens → Tasks 20–25; verification → Task 26. Every spec section maps to at least one task.
- **Naming:** `CalEvent`, `CalFilters`, `MobileFilters`, `Layer`, `DragState`, `Interval`, `Placed`,
  `DayDensity`, `PagerStep`, `Column<T>` are defined once (Tasks 11, 12, 13, 14, 18, 4) and referenced
  with the same names everywhere after. `CalFilters` is what the event builder needs (`layers`, `who`);
  `MobileFilters` extends it with the job-level `status` and `q`.
- **Known ordering constraint:** Task 16 depends on Task 13's `DragState` shape and Task 15's
  `PX_PER_MIN`; Task 17b depends on Task 11's `dayDensity` and Task 12's `CalEvent`; Task 19 depends on
  Tasks 14–18. Do not reorder Phase 5.
- **Deliberately not covered:** service worker / offline, push notifications, real authentication,
  backend — all out of scope per the spec.
