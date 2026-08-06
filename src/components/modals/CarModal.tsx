import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../ui'
import { clientName, useStore } from '@/data/store'
import type { Car } from '@/data/types'

const empty = {
  clientId: '',
  make: '',
  model: '',
  year: '' as string,
  engine: '',
  plate: '',
  vin: '',
  chassis: '',
  color: '',
  notes: '',
}

export default function CarModal({
  open,
  onClose,
  onSaved,
  defaultClientId,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (c: Car) => void
  defaultClientId?: string
  editing?: Car
}) {
  const { clients, addCar, updateCar, toast } = useStore()
  const [f, setF] = useState(empty)

  useEffect(() => {
    if (!open) return
    setF(
      editing
        ? { ...empty, ...editing, year: editing.year ? String(editing.year) : '' }
        : { ...empty, clientId: defaultClientId ?? '' },
    )
  }, [open, editing, defaultClientId])

  const set = (k: keyof typeof empty, v: string) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.clientId && f.make.trim() && f.model.trim() && f.plate.trim()

  const save = () => {
    if (!valid) return
    const payload = { ...f, year: f.year ? Number(f.year) : null }
    if (editing) {
      updateCar(editing.id, payload)
      toast('Mașină actualizată')
      onSaved?.({ ...editing, ...payload })
    } else {
      const c = addCar(payload)
      toast('Mașină adăugată')
      onSaved?.(c)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editează mașina' : 'Mașină nouă'}
      subtitle="Asociază mașina unui client existent."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Anulează</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {editing ? 'Salvează' : 'Adaugă mașina'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Proprietar" required className="sm:col-span-2">
          <Select value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">— alege client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientName(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Marcă" required>
          <Input value={f.make} onChange={(e) => set('make', e.target.value)} placeholder="BMW" />
        </Field>
        <Field label="Model" required>
          <Input value={f.model} onChange={(e) => set('model', e.target.value)} placeholder="M4 Competition" />
        </Field>
        <Field label="An fabricație">
          <Input type="number" value={f.year} onChange={(e) => set('year', e.target.value)} />
        </Field>
        <Field label="Motorizare">
          <Input value={f.engine} onChange={(e) => set('engine', e.target.value)} placeholder="3.0 R6 biturbo" />
        </Field>
        <Field label="Nr. înmatriculare" required>
          <Input value={f.plate} onChange={(e) => set('plate', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Culoare">
          <Input value={f.color} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field label="VIN">
          <Input value={f.vin} onChange={(e) => set('vin', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Serie șasiu">
          <Input value={f.chassis} onChange={(e) => set('chassis', e.target.value)} />
        </Field>
        <Field label="Mențiuni" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
