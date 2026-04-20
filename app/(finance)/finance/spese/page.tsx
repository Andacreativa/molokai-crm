"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Receipt,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  fmt,
  MESI,
  ANNI,
  CATEGORIE_SPESA,
  CATEGORIE_COLORI,
  CATEGORIA_TEXT,
} from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface Spesa {
  id: number;
  data: string; // ISO
  fornitore: string;
  categoria: string;
  descrizione: string | null;
  importo: number;
  ivaDeducibile: boolean;
  aliquotaIva: number;
  ivaRecuperabile: number;
  mese: number;
  anno: number;
  ricevutaPath: string | null;
  note: string | null;
}

interface SpesaFissa {
  id: number;
  tipo: string;
  categoria: string | null;
  cadenza: string;
  dataPagamento: string;
  costo: number;
  costoMensile: number;
  ordine: number;
  attiva: boolean;
  note: string | null;
}

const CADENZE = ["mensile", "annuale", "trimestrale"];

interface Prefill {
  data?: string;
  fornitore?: string;
  categoria?: string;
  importo?: number | string;
  descrizione?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

const isoDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function SpesePage() {
  const [rows, setRows] = useState<Spesa[]>([]);
  const [speseFisse, setSpeseFisse] = useState<SpesaFissa[]>([]);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Spesa | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await fetch(`/api/spese?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };
  const loadFisse = async () => {
    const res = await fetch(`/api/spese-fisse`);
    const data = await res.json();
    setSpeseFisse(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  useEffect(() => {
    loadFisse();
  }, []);

  // Spese fisse: somma costoMensile (solo attive)
  const speseFisseMensili = useMemo(
    () =>
      speseFisse
        .filter((s) => s.attiva)
        .reduce((s, x) => s + x.costoMensile, 0),
    [speseFisse],
  );

  // Mesi "attivi" su cui applicare le spese fisse:
  // - anno corrente: 1..mese corrente
  // - anno passato: tutti 12
  // - anno futuro: tutti 12 (planning)
  const today = new Date();
  const mesiAttiviFisse = useMemo(() => {
    if (anno === today.getFullYear()) return today.getMonth() + 1;
    return 12;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);
  const speseFisseAnno = useMemo(
    () => Math.round(speseFisseMensili * mesiAttiviFisse * 100) / 100,
    [speseFisseMensili, mesiAttiviFisse],
  );

  const rowsFiltrate = useMemo(() => {
    let r = rows;
    if (meseFiltro !== null) r = r.filter((x) => x.mese === meseFiltro);
    if (categoriaFiltro) r = r.filter((x) => x.categoria === categoriaFiltro);
    return r;
  }, [rows, meseFiltro, categoriaFiltro]);

  // Stats
  const totaleAnno = useMemo(
    () => rows.reduce((s, r) => s + r.importo, 0),
    [rows],
  );

  // Riepilogo mensile: variabili + spese fisse (per i soli mesi attivi).
  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const r of rows) arr[r.mese - 1] += r.importo;
    for (let m = 1; m <= mesiAttiviFisse; m++) {
      arr[m - 1] = Math.round((arr[m - 1] + speseFisseMensili) * 100) / 100;
    }
    return arr;
  }, [rows, speseFisseMensili, mesiAttiviFisse]);

  const totaleAnnoCompleto = useMemo(
    () => totaliMensili.reduce((a, b) => a + b, 0),
    [totaliMensili],
  );

  // IVA recuperabile mensile (solo da spese variabili con ivaDeducibile=true).
  // NON include le spese fisse e NON entra nei totali principali.
  const ivaMensile = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const r of rows) {
      if (r.ivaDeducibile) arr[r.mese - 1] += r.ivaRecuperabile;
    }
    return arr.map((v) => Math.round(v * 100) / 100);
  }, [rows]);
  const ivaAnno = useMemo(
    () => Math.round(ivaMensile.reduce((a, b) => a + b, 0) * 100) / 100,
    [ivaMensile],
  );

  const openNew = () => {
    setEditing(null);
    setPrefill(null);
    setShowForm(true);
  };
  const openEdit = (s: Spesa) => {
    setEditing(s);
    setPrefill(null);
    setShowForm(true);
  };
  const del = async (id: number) => {
    if (!confirm("Eliminare questa spesa?")) return;
    await fetch(`/api/spese/${id}`, { method: "DELETE" });
    load();
  };

  const handleOCRFile = async (file: File) => {
    setOcrLoading(true);
    setOcrError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/spese/ocr", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setOcrError(json?.error || "Errore OCR");
        return;
      }
      const d = json.data as Record<string, unknown>;
      setEditing(null);
      setPrefill({
        data: typeof d.data === "string" ? d.data : undefined,
        fornitore: typeof d.fornitore === "string" ? d.fornitore : undefined,
        categoria: typeof d.categoria === "string" ? d.categoria : undefined,
        importo:
          typeof d.importo === "number" || typeof d.importo === "string"
            ? d.importo
            : undefined,
        descrizione:
          typeof d.descrizione === "string" ? d.descrizione : undefined,
      });
      setShowForm(true);
    } catch (e) {
      setOcrError(String(e instanceof Error ? e.message : e));
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spese</h1>
          <p className="text-gray-500 text-sm mt-1">
            {rowsFiltrate.length} spese
            {meseFiltro !== null ? ` · ${MESI[meseFiltro - 1]}` : ""}
            {categoriaFiltro ? ` · ${categoriaFiltro}` : ""}
            {" · anno "}
            {anno}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            className="text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 outline-none"
          >
            {ANNI.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={() => ocrInputRef.current?.click()}
            disabled={ocrLoading}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-60"
            title="Carica scontrino o fattura, i dati vengono estratti con Claude AI"
          >
            {ocrLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Analisi...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" style={{ color: "#0ea5e9" }} />
                Importa Scontrino/Fattura
              </>
            )}
          </button>
          <input
            ref={ocrInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleOCRFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={openNew}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Aggiungi Spesa
          </button>
        </div>
      </div>

      {ocrError && (
        <div className="rounded-2xl p-3 bg-red-50 text-red-800 text-sm flex items-start gap-2">
          <span className="flex-1">{ocrError}</span>
          <button
            onClick={() => setOcrError(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Filtri */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={meseFiltro ?? ""}
          onChange={(e) =>
            setMeseFiltro(e.target.value ? parseInt(e.target.value) : null)
          }
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
        >
          <option value="">Tutti i mesi</option>
          {MESI.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
        >
          <option value="">Tutte le categorie</option>
          {CATEGORIE_SPESA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(meseFiltro !== null || categoriaFiltro) && (
          <button
            onClick={() => {
              setMeseFiltro(null);
              setCategoriaFiltro("");
            }}
            className="text-xs text-gray-500 hover:text-sky-600 px-3 py-2"
          >
            Rimuovi filtri
          </button>
        )}
      </div>

      {/* Stats */}
      <StatCard label={`Totale Spese ${anno}`} value={totaleAnnoCompleto} />

      {/* Riepilogo mensile */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo spese mensili
          </h3>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MESI.map((meseNome, idx) => {
            const m = idx + 1;
            const tot = totaliMensili[idx];
            const hasValue = tot > 0;
            const isActive = meseFiltro === m;
            const cellStyle = isActive
              ? { background: "#0ea5e9", borderColor: "#0284c7" }
              : hasValue
                ? { background: "#e0f2fe", borderColor: "#7dd3fc" }
                : { background: "#fff", borderColor: "#e2e8f0" };
            const labelColor = isActive
              ? "#ffffff"
              : hasValue
                ? "#6b7280"
                : "#9ca3af";
            const valueColor = isActive
              ? "#ffffff"
              : hasValue
                ? "#0369a1"
                : "#cbd5e1";
            return (
              <button
                key={meseNome}
                type="button"
                onClick={() => setMeseFiltro(isActive ? null : m)}
                className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg border transition-all cursor-pointer hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                style={cellStyle}
                title={
                  isActive
                    ? "Clicca per rimuovere il filtro"
                    : `Filtra per ${meseNome}`
                }
              >
                <span
                  className="text-[10px] uppercase tracking-wide font-semibold"
                  style={{ color: labelColor }}
                >
                  {meseNome.slice(0, 3)}
                </span>
                <span
                  className="text-[11px] font-bold whitespace-nowrap"
                  style={{ color: valueColor }}
                >
                  {hasValue ? fmt(tot) : "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Riga informativa IVA recuperabile per mese (non entra nei totali principali) */}
        {ivaAnno > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-sky-700 uppercase tracking-wide">
                IVA Recuperabile (informativa)
              </span>
              <span className="text-xs font-bold text-sky-700">
                {fmt(ivaAnno)} / anno
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
              {ivaMensile.map((v, i) => (
                <div
                  key={MESI[i]}
                  className="text-center text-[9px] py-1 rounded bg-white/60"
                >
                  <span className="text-gray-400 uppercase">
                    {MESI[i].slice(0, 3)}
                  </span>
                  <p className="font-semibold text-sky-700">
                    {v > 0 ? fmt(v).replace(" €", "") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Totale {anno}
          </span>
          <div className="flex items-baseline gap-3">
            {speseFisseMensili > 0 && (
              <span className="text-[10px] text-gray-400">
                ({fmt(totaleAnno)} variabili + {fmt(speseFisseAnno)} fisse su{" "}
                {mesiAttiviFisse} mesi)
              </span>
            )}
            <span className="text-lg font-bold" style={{ color: "#0ea5e9" }}>
              {fmt(totaleAnnoCompleto)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabella */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Data",
                  "Mese",
                  "Fornitore",
                  "Categoria",
                  "Importo",
                  "Note",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === "Importo" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {rowsFiltrate.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nessuna spesa per {anno}
                    {meseFiltro !== null ? ` / ${MESI[meseFiltro - 1]}` : ""}
                    {categoriaFiltro ? ` / ${categoriaFiltro}` : ""}
                  </td>
                </tr>
              )}
              {rowsFiltrate.map((r) => {
                const bg = CATEGORIE_COLORI[r.categoria] ?? "#EDEDED";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(r.data).toLocaleDateString("it-IT")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {MESI[r.mese - 1]}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {r.fornitore}
                      {r.descrizione && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.descrizione}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: bg, color: CATEGORIA_TEXT }}
                      >
                        {r.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                      {fmt(r.importo)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[240px] truncate">
                      {r.note ?? ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(r.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <SpesaFormModal
          editing={editing}
          prefill={prefill}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {/* Sezione Spese Fisse */}
      <SpeseFisseSection speseFisse={speseFisse} onChanged={loadFisse} />
    </div>
  );
}

// ─── Form Modal ────────────────────────────────────────────────────────

function SpesaFormModal({
  editing,
  prefill,
  onClose,
  onSaved,
}: {
  editing: Spesa | null;
  prefill: Prefill | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialData = editing
    ? isoDate(editing.data)
    : prefill?.data && /^\d{4}-\d{2}-\d{2}/.test(prefill.data)
      ? prefill.data
      : isoDate(new Date());
  const initialCat = editing?.categoria
    ? editing.categoria
    : prefill?.categoria && CATEGORIE_SPESA.includes(prefill.categoria)
      ? prefill.categoria
      : "Altro";
  const initialImporto = editing
    ? String(editing.importo)
    : prefill?.importo !== undefined
      ? String(prefill.importo)
      : "0";

  const [form, setForm] = useState({
    data: initialData,
    fornitore: editing?.fornitore ?? prefill?.fornitore ?? "",
    categoria: initialCat,
    importo: initialImporto,
    descrizione: editing?.descrizione ?? prefill?.descrizione ?? "",
    note: editing?.note ?? "",
    ivaDeducibile: editing?.ivaDeducibile ?? true,
    aliquotaIva: String(editing?.aliquotaIva ?? 21),
    ivaRecuperabile: String(editing?.ivaRecuperabile ?? 0),
  });
  const [saving, setSaving] = useState(false);

  // Auto-calcolo IVA recuperabile quando importo, aliquota o deducibile cambiano.
  // L'utente può sovrascrivere manualmente; cambi successivi a importo/aliquota
  // ri-sovrascrivono il manuale (comportamento esplicito dichiarato).
  useEffect(() => {
    const importo = parseFloat(form.importo) || 0;
    const aliq = parseFloat(form.aliquotaIva) || 0;
    if (!form.ivaDeducibile || aliq <= 0) {
      setForm((f) =>
        f.ivaRecuperabile === "0" ? f : { ...f, ivaRecuperabile: "0" },
      );
      return;
    }
    const rate = aliq / 100;
    const recup = Math.round((importo / (1 + rate)) * rate * 100) / 100;
    setForm((f) =>
      f.ivaRecuperabile === String(recup)
        ? f
        : { ...f, ivaRecuperabile: String(recup) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.importo, form.aliquotaIva, form.ivaDeducibile]);

  const save = async () => {
    if (!form.fornitore.trim() || !form.data) return;
    setSaving(true);
    const payload = {
      data: form.data,
      fornitore: form.fornitore.trim(),
      categoria: form.categoria,
      importo: parseFloat(form.importo) || 0,
      ivaDeducibile: form.ivaDeducibile,
      aliquotaIva: parseFloat(form.aliquotaIva) || 0,
      ivaRecuperabile: parseFloat(form.ivaRecuperabile) || 0,
      descrizione: form.descrizione,
      note: form.note,
    };
    try {
      if (editing) {
        await fetch(`/api/spese/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/spese", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editing
              ? "Modifica Spesa"
              : prefill
                ? "Spesa da Scontrino"
                : "Nuova Spesa"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {prefill && !editing && (
          <div
            className="rounded-xl p-3 text-xs flex items-start gap-2"
            style={{ background: "#f0f9ff", color: "#0369a1" }}
          >
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Dati estratti automaticamente dallo scontrino. Verifica e correggi
              prima di salvare.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Data *
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Importo (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={form.importo}
              onChange={(e) =>
                setForm((f) => ({ ...f, importo: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Fornitore *
            </label>
            <input
              type="text"
              value={form.fornitore}
              onChange={(e) =>
                setForm((f) => ({ ...f, fornitore: e.target.value }))
              }
              placeholder="Es. Leroy Merlin"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Categoria
            </label>
            <select
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {CATEGORIE_SPESA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Sezione IVA */}
          <div className="col-span-2 border-t border-gray-200 pt-4 mt-1">
            <div className="flex items-center justify-between mb-3">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ivaDeducibile}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ivaDeducibile: e.target.checked }))
                  }
                  className="w-4 h-4"
                  style={{ accentColor: "#0ea5e9" }}
                />
                <span className="text-sm text-gray-700 font-medium">
                  IVA deducibile
                </span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Aliquota IVA (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.aliquotaIva}
                  disabled={!form.ivaDeducibile}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, aliquotaIva: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  IVA recuperabile (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.ivaRecuperabile}
                  disabled={!form.ivaDeducibile}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ivaRecuperabile: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right disabled:bg-gray-50 disabled:text-gray-400"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Calcolato da importo ÷ (1+aliq) × aliq, modificabile
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Descrizione
            </label>
            <input
              type="text"
              value={form.descrizione}
              onChange={(e) =>
                setForm((f) => ({ ...f, descrizione: e.target.value }))
              }
              placeholder="Es. Pavimento magazzino"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Note
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving || !form.fornitore.trim() || !form.data}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {fmt(value)}
      </p>
    </div>
  );
}

// ─── Spese Fisse Section ───────────────────────────────────────────────

function SpeseFisseSection({
  speseFisse,
  onChanged,
}: {
  speseFisse: SpesaFissa[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SpesaFissa | null>(null);

  const totaleMensile = speseFisse
    .filter((s) => s.attiva)
    .reduce((s, x) => s + x.costoMensile, 0);

  const del = async (id: number) => {
    if (!confirm("Eliminare questa spesa fissa?")) return;
    await fetch(`/api/spese-fisse/${id}`, { method: "DELETE" });
    onChanged();
  };

  const toggleAttiva = async (s: SpesaFissa) => {
    await fetch(`/api/spese-fisse/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attiva: !s.attiva }),
    });
    onChanged();
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Spese Fisse</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Spese ricorrenti normalizzate al mese — sommate al totale annuo
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
        >
          <Plus className="w-4 h-4" /> Aggiungi Fissa
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Tipo",
                  "Categoria",
                  "Cadenza",
                  "Costo",
                  "Costo/mese",
                  "Pagamento",
                  "Attiva",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${["Costo", "Costo/mese"].includes(h) ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {speseFisse.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    Nessuna spesa fissa
                  </td>
                </tr>
              )}
              {speseFisse.map((s) => {
                const bg = s.categoria
                  ? (CATEGORIE_COLORI[s.categoria] ?? "#EDEDED")
                  : "#EDEDED";
                return (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    style={s.attiva ? undefined : { opacity: 0.5 }}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {s.tipo}
                    </td>
                    <td className="px-4 py-3">
                      {s.categoria ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: bg, color: CATEGORIA_TEXT }}
                        >
                          {s.categoria}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                      {s.cadenza}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {fmt(s.costo)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{ color: "#0ea5e9" }}
                    >
                      {fmt(s.costoMensile)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.dataPagamento || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.attiva}
                          onChange={() => toggleAttiva(s)}
                          className="w-4 h-4"
                          style={{ accentColor: "#0ea5e9" }}
                        />
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setEditing(s);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(s.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {speseFisse.length > 0 && (
                <tr className="bg-amber-50">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-xs font-semibold text-amber-800 uppercase tracking-wide text-right"
                  >
                    Totale mensile (solo attive)
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-bold text-right"
                    style={{ color: "#a16207" }}
                  >
                    {fmt(totaleMensile)}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs text-amber-700">
                    × 12 = {fmt(totaleMensile * 12)} / anno
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <SpesaFissaFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function SpesaFissaFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: SpesaFissa | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    tipo: editing?.tipo ?? "",
    categoria: editing?.categoria ?? "",
    cadenza: editing?.cadenza ?? "mensile",
    costo: String(editing?.costo ?? ""),
    dataPagamento: editing?.dataPagamento ?? "",
    note: editing?.note ?? "",
    attiva: editing?.attiva ?? true,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.tipo.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      costo: parseFloat(form.costo) || 0,
      categoria: form.categoria || null,
    };
    try {
      if (editing) {
        await fetch(`/api/spese-fisse/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/spese-fisse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? "Modifica Spesa Fissa" : "Nuova Spesa Fissa"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Tipo *
            </label>
            <input
              type="text"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              placeholder="Es. Affitto"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Categoria
            </label>
            <select
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">— Nessuna —</option>
              {CATEGORIE_SPESA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Cadenza
            </label>
            <select
              value={form.cadenza}
              onChange={(e) =>
                setForm((f) => ({ ...f, cadenza: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white capitalize"
            >
              {CADENZE.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Costo (€) *
            </label>
            <input
              type="number"
              step="0.01"
              value={form.costo}
              onChange={(e) =>
                setForm((f) => ({ ...f, costo: e.target.value }))
              }
              placeholder="969"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Per cadenza annuale/trimestrale, il costo/mese è ricalcolato
              automaticamente
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Data pagamento
            </label>
            <input
              type="text"
              value={form.dataPagamento}
              onChange={(e) =>
                setForm((f) => ({ ...f, dataPagamento: e.target.value }))
              }
              placeholder="Es. 1° del mese"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Note
            </label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
            />
          </div>
          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.attiva}
                onChange={(e) =>
                  setForm((f) => ({ ...f, attiva: e.target.checked }))
                }
                className="w-4 h-4"
                style={{ accentColor: "#0ea5e9" }}
              />
              <span className="text-sm text-gray-700 font-medium">
                Attiva (somma nel totale)
              </span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving || !form.tipo.trim()}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}
