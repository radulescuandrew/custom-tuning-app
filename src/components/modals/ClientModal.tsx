import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../ui'
import { useStore } from '@/data/store'
import type { Client } from '@/data/types'

const empty = {
  type: 'pf' as Client['type'],
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  cnp: '',
  address: '',
  companyName: '',
  vatId: '',
  notes: '',
}

export default function ClientModal({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (c: Client) => void
  editing?: Client
}) {
  const { addClient, updateClient, toast } = useStore()
  const [f, setF] = useState(empty)

  useEffect(() => {
    if (!open) return
    setF(editing ? { ...empty, ...editing } : empty)
  }, [open, editing])

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setF((p) => ({ ...p, [k]: v }))

  const valid =
    f.lastName.trim() && (f.type === 'pf' || (f.companyName.trim() && f.vatId.trim()))

  const save = () => {
    if (!valid) return
    if (editing) {
      updateClient(editing.id, f)
      toast('Client actualizat')
      onSaved?.({ ...editing, ...f })
    } else {
      const c = addClient(f)
      toast('Client adăugat')
      onSaved?.(c)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editează client' : 'Client nou'}
      subtitle="Datele de facturare sunt obligatorii doar pentru persoane juridice."
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Anulează</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {editing ? 'Salvează' : 'Adaugă client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Formă juridică">
          <Select value={f.type} onChange={(e) => set('type', e.target.value as Client['type'])}>
            <option value="pf">Persoană fizică</option>
            <option value="pj">Persoană juridică</option>
          </Select>
        </Field>
        <Field label="Telefon">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="07xx xxx xxx" />
        </Field>
        <Field label="Nume" required>
          <Input value={f.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Prenume">
          <Input value={f.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        {f.type === 'pf' ? (
          <Field label="CNP">
            <Input value={f.cnp} onChange={(e) => set('cnp', e.target.value)} />
          </Field>
        ) : (
          <Field label="CUI / RO" required>
            <Input value={f.vatId} onChange={(e) => set('vatId', e.target.value)} placeholder="RO12345678" />
          </Field>
        )}
        {f.type === 'pj' && (
          <Field label="Denumire firmă" required className="sm:col-span-2">
            <Input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </Field>
        )}
        <Field label="Adresă" className="sm:col-span-2">
          <Input value={f.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Mențiuni" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
