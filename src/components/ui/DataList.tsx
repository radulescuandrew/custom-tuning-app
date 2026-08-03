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
              className={
                onRowClick
                  ? 'cursor-pointer border-b border-line hover:bg-black/[0.03]'
                  : 'border-b border-line'
              }
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
