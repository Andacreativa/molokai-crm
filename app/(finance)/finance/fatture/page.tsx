'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, Download, FileSpreadsheet } from 'lucide-react'
import { fmt, MESI, AZIENDE, AZIENDA_COLORI } from '@/lib/constants'
import FiltriBar from '@/components/FiltriBar'
import { useAnno } from '@/lib/anno-context'
import { exportExcel, exportPDF, fattureToExcel, fattureToPDF } from '@/lib/export'

interface Cliente { id: number; nome: string; paese: string }
interface Fattura {
  id: number; clienteId: number; cliente: Cliente
  azienda: string; aziendaNota: string | null; descrizione: string | null
  mese: number; anno: number; importo: number
  pagato: boolean; scadenza: string | null
}

const MESI_NUMS = Array.from({ length: 12 }, (_, i) => i + 1)
const emptyForm = { clienteId: '', azienda: AZIENDE[0], aziendaNota: '', descrizione: '', mese: new Date().getMonth() + 1, anno: 2025, importo: '', pagato: false, scadenza: '' }

export default function FatturePage() {
  const [fatture, setFatture] = useState<Fattura[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fattura | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [filtroMese, setFiltroMese] = useState(0)
  const [filtroPagato, setFiltroPagato] = useState<'tutti' | 'pagato' | 'attesa'>('tutti')
  const { anno, setAnno } = useAnno()
  const [azienda, setAzienda] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const load = async () => {
    const params = new URLSearchParams({ anno: String(anno) })
    if (azienda) params.set('azienda', azienda)
    const [f, c] = await Promise.all([
      (await fetch(`/api/fatture?${params}`)).json() as Promise<any>,
      (await fetch('/api/clienti')).json() as Promise<any>,
    ])
    setFatture(Array.isArray(f) ? f : [])
    setClienti(Array.isArray(c) ? c : [])
  }
  useEffect(() => { load() }, [anno, azienda])

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, anno }); setShowForm(true) }
  const openEdit = (f: Fattura) => {
    setEditing(f)
    setForm({ clienteId: String(f.clienteId), azienda: f.azienda, aziendaNota: f.aziendaNota || '', descrizione: f.descrizione || '', mese: f.mese, anno: f.anno, importo: String(f.importo), pagato: f.pagato, scadenza: f.scadenza ? f.scadenza.slice(0, 10) : '' })
    setShowForm(true)
  }
  const save = async () => {
    if (!form.clienteId || !form.importo) return
    const payload = { ...form, clienteId: parseInt(form.clienteId), importo: parseFloat(form.importo), scadenza: form.scadenza || null, aziendaNota: form.azienda === 'Altro' ? form.aziendaNota : null }
    if (editing) await fetch(`/api/fatture/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    else await fetch('/api/fatture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setShowForm(false); load()
  }
  const togglePagato = async (f: Fattura) => {
    await fetch(`/api/fatture/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagato: !f.pagato }) })
    load()
  }
  const del = async (id: number) => {
    if (!confirm('Eliminare questa fattura?')) return
    await fetch(`/api/fatture/${id}`, { method: 'DELETE' }); load()
  }

  const filtered = (fatture ?? []).filter(f => {
    if (filtroMese && f.mese !== filtroMese) return false
    if (filtroPagato === 'pagato' && !f.pagato) return false
    if (filtroPagato === 'attesa' && f.pagato) return false
    return true
  })

  const totale = filtered.reduce((s, f) => s + (f?.importo ?? 0), 0)
  const pagate = filtered.filter(f => f?.pagato).reduce((s, f) => s + (f?.importo ?? 0), 0)

  const oggi = new Date()
  const isScaduta = (f: Fattura) => !f.pagato && f.scadenza && new Date(f.scadenza) < oggi
  const isInScadenza = (f: Fattura) => {
    if (!f.scadenza || f.pagato) return false
    const d = new Date(f.scadenza)
    const giorni = Math.ceil((d.getTime() - oggi.getTime()) / 86400000)
    return giorni >= 0 && giorni <= 7
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fatture</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} fatture</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FiltriBar anno={anno} azienda={azienda} onAnno={setAnno} onAzienda={setAzienda} />
          <button onClick={() => exportExcel(fattureToExcel(filtered, MESI), `fatture_${anno}`)}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
          </button>
          <button onClick={() => { const { cols, rows, title } = fattureToPDF(filtered, MESI, `Fatture ${anno}`); exportPDF(title, cols, rows, `fatture_${anno}`) }}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 text-red-500" /> PDF
          </button>
          <button onClick={openNew} className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
            <Plus className="w-4 h-4" /> Nuova Fattura
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Totale', val: fmt(totale), color: 'text-gray-900' },
          { label: 'Incassato', val: fmt(pagate), color: 'text-emerald-600' },
          { label: 'Da Incassare', val: fmt(totale - pagate), color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="glass-card rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div className="flex gap-3 flex-wrap">
        <select value={filtroMese} onChange={e => setFiltroMese(parseInt(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-300">
          <option value={0}>Tutti i mesi</option>
          {MESI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['tutti', 'pagato', 'attesa'] as const).map(v => (
            <button key={v} onClick={() => setFiltroPagato(v)}
              className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
              style={filtroPagato === v ? { background: '#e8308a', color: '#fff' } : { color: '#64748b' }}>
              {v === 'tutti' ? 'Tutti' : v === 'pagato' ? 'Pagati' : 'In Attesa'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Cliente', 'Azienda', 'Mese', 'Scadenza', 'Descrizione', 'Importo', 'Stato', ''].map(h => (
                <th key={h} className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === 'Importo' ? 'text-right' : h === 'Stato' ? 'text-center' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12 text-sm">Nessuna fattura trovata</td></tr>
            )}
            {filtered.map(f => (
              <tr key={f.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${isScaduta(f) ? 'bg-red-50' : isInScadenza(f) ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.cliente?.nome ?? '—'}<span className="ml-1 text-xs text-gray-400">{f.cliente?.paese ?? ''}</span></td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background: f.azienda === 'Spagna' ? '#fef2f2' : f.azienda === 'Italia' ? '#f0fdf4' : '#f8fafc', color: f.azienda === 'Spagna' ? '#ef4444' : f.azienda === 'Italia' ? '#22c55e' : '#64748b' }}>
                    {f.azienda === 'Altro' && f.aziendaNota ? f.aziendaNota : f.azienda}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{MESI[f.mese - 1]}</td>
                <td className="px-4 py-3 text-sm">
                  {f.scadenza ? (
                    <span className={`text-xs font-medium ${isScaduta(f) ? 'text-red-600' : isInScadenza(f) ? 'text-amber-600' : 'text-gray-500'}`}>
                      {new Date(f.scadenza).toLocaleDateString('it-IT')}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{f.descrizione || '—'}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmt(f.importo)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => togglePagato(f)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full transition-colors ${f.pagato ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                    {f.pagato ? <><Check className="w-3 h-3" /> Pagato</> : <><X className="w-3 h-3" /> In Attesa</>}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(f.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="glass-modal rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Modifica Fattura' : 'Nuova Fattura'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Azienda *</label>
                <div className="flex gap-2">
                  {AZIENDE.map(a => {
                    const col = AZIENDA_COLORI[a]
                    const active = form.azienda === a
                    return (
                      <button key={a} onClick={() => setForm(f => ({ ...f, azienda: a, aziendaNota: '' }))}
                        className="flex-1 text-sm py-2 rounded-lg border font-semibold transition-all"
                        style={active ? { background: col.bg, color: col.text, borderColor: col.border } : { background: '#fff', borderColor: '#e2e8f0', color: '#94a3b8' }}>
                        {a}
                      </button>
                    )
                  })}
                </div>
                {form.azienda === 'Altro' && (
                  <input
                    type="text"
                    value={form.aziendaNota}
                    onChange={e => setForm(f => ({ ...f, aziendaNota: e.target.value }))}
                    placeholder="Specifica provenienza..."
                    className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Cliente *</label>
                <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                  <option value="">Seleziona cliente...</option>
                  {clienti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Mese *</label>
                  <select value={form.mese} onChange={e => setForm(f => ({ ...f, mese: parseInt(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300">
                    {MESI_NUMS.map(m => <option key={m} value={m}>{MESI[m - 1]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Importo (€) *</label>
                  <input type="number" step="0.01" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                    placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Descrizione</label>
                  <input type="text" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                    placeholder="Es. Consulenza" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Scadenza</label>
                  <input type="date" value={form.scadenza} onChange={e => setForm(f => ({ ...f, scadenza: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.pagato} onChange={e => setForm(f => ({ ...f, pagato: e.target.checked }))} className="w-4 h-4" style={{ accentColor: '#e8308a' }} />
                <span className="text-sm text-gray-700">Già pagata</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50">Annulla</button>
              <button onClick={save} className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl">
                {editing ? 'Salva' : 'Aggiungi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
