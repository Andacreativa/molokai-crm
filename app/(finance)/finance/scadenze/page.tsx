'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, CheckCircle, Check } from 'lucide-react'
import { fmt, MESI, AZIENDE, ANNI } from '@/lib/constants'
import { useAnno } from '@/lib/anno-context'

interface Fattura {
  id: number; importo: number; pagato: boolean
  mese: number; anno: number; scadenza: string | null
  azienda: string; descrizione: string | null
  cliente: { nome: string; paese: string }
}

type Stato = 'scaduta' | 'urgente' | 'prossima' | 'ok'

function classificaScadenza(f: Fattura): Stato {
  if (!f.scadenza || f.pagato) return 'ok'
  const oggi = new Date()
  const scad = new Date(f.scadenza)
  const giorni = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000)
  if (giorni < 0) return 'scaduta'
  if (giorni <= 7) return 'urgente'
  if (giorni <= 30) return 'prossima'
  return 'ok'
}

const STATI_CONFIG = {
  scaduta: { label: 'Scaduta', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle, iconColor: 'text-red-500' },
  urgente: { label: 'Urgente (≤7 gg)', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: Clock, iconColor: 'text-amber-500' },
  prossima: { label: 'In scadenza (≤30 gg)', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Clock, iconColor: 'text-blue-400' },
  ok: { label: 'OK', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: CheckCircle, iconColor: 'text-emerald-500' },
}

export default function ScadenzePage() {
  const [fatture, setFatture] = useState<Fattura[]>([])
  const { anno, setAnno } = useAnno()
  const [filtroAzienda, setFiltroAzienda] = useState('')
  const [filtroStato, setFiltroStato] = useState<'tutte' | 'scaduta' | 'urgente' | 'prossima'>('tutte')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const load = async () => {
    const params = new URLSearchParams({ anno: String(anno) })
    if (filtroAzienda) params.set('azienda', filtroAzienda)
    const data = (await (await fetch(`/api/fatture?${params}`)).json()) as any
    const arr: Fattura[] = Array.isArray(data) ? data : []
    setFatture(arr.filter(f => !f?.pagato && f?.scadenza))
  }
  useEffect(() => { load() }, [anno, filtroAzienda])

  const togglePagato = async (f: Fattura) => {
    await fetch(`/api/fatture/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagato: true }) })
    load()
  }

  const oggi = new Date()
  const withStato = (fatture ?? []).map(f => ({ ...f, stato: classificaScadenza(f) }))

  const filtered = withStato.filter(f => {
    if (filtroStato === 'tutte') return f.stato !== 'ok'
    return f.stato === filtroStato
  }).sort((a, b) => new Date(a.scadenza!).getTime() - new Date(b.scadenza!).getTime())

  const scadute = withStato.filter(f => f.stato === 'scaduta')
  const urgenti = withStato.filter(f => f.stato === 'urgente')
  const prossime = withStato.filter(f => f.stato === 'prossima')

  const totScadute = scadute.reduce((s, f) => s + f.importo, 0)
  const totUrgenti = urgenti.reduce((s, f) => s + f.importo, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scadenze</h1>
          <p className="text-gray-500 text-sm mt-1">Fatture non pagate con data di scadenza</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={anno}
            onChange={e => setAnno(parseInt(e.target.value))}
            className="text-sm font-semibold px-3 py-1.5 rounded-xl border-none outline-none cursor-pointer appearance-none"
            style={{
              background: '#e8308a',
              color: '#ffffff',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              paddingRight: '28px',
            }}
          >
            {ANNI.map(a => (
              <option key={a} value={a} style={{ background: '#fff', color: '#1a1d2e' }}>{a}</option>
            ))}
          </select>
          <select value={filtroAzienda} onChange={e => setFiltroAzienda(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-pink-300">
            <option value="">Tutte le aziende</option>
            {AZIENDE.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* KPI scadenze */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Scadute</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(totScadute)}</p>
          <p className="text-xs text-red-500 mt-1">{scadute.length} {scadute.length === 1 ? 'fattura' : 'fatture'}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Urgenti (7 gg)</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{fmt(totUrgenti)}</p>
          <p className="text-xs text-amber-500 mt-1">{urgenti.length} {urgenti.length === 1 ? 'fattura' : 'fatture'}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Prossime (30 gg)</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{fmt(prossime.reduce((s, f) => s + f.importo, 0))}</p>
          <p className="text-xs text-blue-500 mt-1">{prossime.length} {prossime.length === 1 ? 'fattura' : 'fatture'}</p>
        </div>
      </div>

      {/* Filtro stato */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { val: 'tutte', label: 'Tutte le pendenti' },
          { val: 'scaduta', label: 'Scadute' },
          { val: 'urgente', label: 'Urgenti' },
          { val: 'prossima', label: 'Prossime' },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => setFiltroStato(val as typeof filtroStato)}
            className="text-sm px-4 py-1.5 rounded-lg font-medium transition-colors"
            style={filtroStato === val ? { background: '#e8308a', color: '#fff' } : { color: '#64748b' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista fatture */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Nessuna scadenza pendente</p>
          <p className="text-gray-400 text-sm mt-1">Tutte le fatture con scadenza sono in ordine</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const cfg = STATI_CONFIG[f.stato]
            const scad = new Date(f.scadenza!)
            const giorni = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000)
            return (
              <div key={f.id} className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center justify-between gap-4 ${cfg.border}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                    <cfg.icon className={`w-5 h-5 ${cfg.iconColor}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{f.cliente?.nome ?? '—'}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">{f.azienda}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {MESI[f.mese - 1]} {f.anno}{f.descrizione ? ` · ${f.descrizione}` : ''}
                    </p>
                    <p className={`text-xs font-medium mt-1 ${cfg.text}`}>
                      {giorni < 0
                        ? `Scaduta da ${Math.abs(giorni)} giorni`
                        : giorni === 0 ? 'Scade oggi!'
                        : `Scade il ${scad.toLocaleDateString('it-IT')} (fra ${giorni} giorni)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <p className="text-xl font-bold text-gray-900">{fmt(f.importo)}</p>
                  <button onClick={() => togglePagato(f)}
                    className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl text-white transition-all"
                    style={{ background: 'linear-gradient(160deg, #34d399 0%, #10b981 50%, #059669 100%)', boxShadow: '0 1px 0 0 rgba(180,255,220,0.5) inset, 0 -1px 0 0 rgba(0,80,40,0.3) inset, 0 4px 12px rgba(16,185,129,0.3)' }}>
                    <Check className="w-4 h-4" /> Segna Pagata
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
