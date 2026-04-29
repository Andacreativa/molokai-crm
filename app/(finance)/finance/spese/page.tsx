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
  Upload,
  FileText,
  Landmark,
  CheckCircle2,
  AlertCircle,
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
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);

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
      setShowOcrModal(false);
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
            onClick={() => {
              setOcrError(null);
              setShowOcrModal(true);
            }}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl"
            title="Carica scontrino o fattura, i dati vengono estratti con Claude AI"
          >
            <Sparkles className="w-4 h-4" style={{ color: "#0ea5e9" }} />
            Importa Scontrino/Fattura
          </button>
          <button
            onClick={() => setShowBankImport(true)}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl"
            title="Importa estratto conto BBVA (.xlsx)"
          >
            <Landmark className="w-4 h-4" style={{ color: "#0ea5e9" }} />
            Importa da Banca
          </button>
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

      {showOcrModal && (
        <OcrUploadModal
          loading={ocrLoading}
          error={ocrError}
          onClose={() => setShowOcrModal(false)}
          onAnalyze={handleOCRFile}
        />
      )}

      {showBankImport && (
        <BankImportModal
          onClose={() => setShowBankImport(false)}
          onImported={() => {
            setShowBankImport(false);
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

// ─── OCR Upload Modal (drag & drop) ────────────────────────────────────

const ACCEPTED_MIMES = ["image/jpeg", "image/png", "application/pdf"];
const ACCEPTED_EXTS = /\.(jpe?g|png|pdf)$/i;

function OcrUploadModal({
  loading,
  error,
  onClose,
  onAnalyze,
}: {
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAnalyze: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isAccepted = (f: File) =>
    ACCEPTED_MIMES.includes(f.type) || ACCEPTED_EXTS.test(f.name);

  const selectFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!isAccepted(f)) {
      setLocalError("Formato non supportato. Usa JPG, PNG o PDF.");
      return;
    }
    setLocalError(null);
    setFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    selectFile(f);
  };

  const isPdf =
    !!file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
  const shownError = error || localError;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: "#0ea5e9" }} />
            <h2 className="text-lg font-bold text-gray-900">
              Importa Scontrino/Fattura
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Carica un&apos;immagine (JPG/PNG) o un PDF. I dati verranno estratti
          automaticamente con Claude AI.
        </p>

        {!file ? (
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-all"
            style={{
              borderColor: dragActive ? "#0ea5e9" : "#cbd5e1",
              background: dragActive ? "#e0f2fe" : "#f8fafc",
            }}
          >
            <Upload
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: dragActive ? "#0ea5e9" : "#94a3b8" }}
            />
            <p className="text-sm font-semibold text-gray-800">
              Trascina qui il file o clicca per selezionarlo
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPG · PNG · PDF — max 10 MB
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              {isPdf ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#fee2e2" }}
                  >
                    <FileText
                      className="w-7 h-7"
                      style={{ color: "#dc2626" }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF · {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center max-h-64">
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Anteprima"
                        className="max-h-64 w-auto object-contain"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="truncate mr-2">{file.name}</span>
                    <span className="flex-shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setLocalError(null);
              }}
              disabled={loading}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium disabled:opacity-40"
            >
              Cambia file
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={(e) => {
            selectFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {shownError && (
          <div className="rounded-xl p-3 bg-red-50 text-red-800 text-xs">
            {shownError}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-40"
          >
            Annulla
          </button>
          <button
            onClick={() => file && onAnalyze(file)}
            disabled={!file || loading}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Analisi in corso…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Analizza
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bank Import Modal (BBVA .xlsx) ────────────────────────────────────

interface ParsedRow {
  id: string;
  selected: boolean;
  data: string; // yyyy-mm-dd
  concepto: string;
  beneficiario: string;
  fornitore: string;
  categoria: string;
  importo: number; // sempre positivo (valore assoluto dell'uscita)
  mese: number;
  anno: number;
  duplicato: boolean;
  // True se la categoria coincide con una SpesaFissa attiva → importarla
  // duplicherebbe l'uscita (la SpesaFissa è già contata automaticamente).
  inSpesaFissa: boolean;
  spesaFissaInfo: string | null; // es. "Affitto €969/mese"
}

// Regole di auto-categorizzazione (match su CONCEPTO + BENEFICIARIO + OBSERVACIONES)
const BBVA_RULES: Array<[RegExp, string]> = [
  [/ALQUILER/i, "Affitto"],
  [/OCTOPUS|AIGUES|DIGI/i, "Utenze"],
  [/IMPUESTOS|TRIBUTOS|TGSS|SEGURIDAD\s*SOCIAL/i, "Tasse"],
  [/ALLIANZ|OCCIDENT|SEGURO/i, "Assicurazione"],
  [/DISPOSICION\s*DE\s*EFECTIVO/i, "Ritiro Contante"],
  [/BOARDS\s*MORE/i, "Materiale Sportivo"],
  [/TRANSFERENCIAS/i, "Rimborsi Soci"],
];

const categorizza = (
  concepto: string,
  beneficiario: string,
  observaciones: string,
): string => {
  const text = `${concepto} ${beneficiario} ${observaciones}`;
  for (const [re, cat] of BBVA_RULES) {
    if (re.test(text)) return cat;
  }
  return "Scuola";
};

// Parsing data: accetta "yyyy-mm-dd", "dd/mm/yyyy", Date, numero seriale Excel
const toIsoDate = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy o dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mm}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
};

const parseImporto = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  // Rimuovi simboli valuta e spazi
  s = s.replace(/[€\s]/g, "");
  // Formato europeo: "1.234,56" → "1234.56". Anche "-1.234,56".
  if (/,\d{1,2}$/.test(s) && s.indexOf(".") < s.lastIndexOf(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

function BankImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setFile(null);
    setRows([]);
    setError(null);
    setResult(null);
  };

  const selectFile = async (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setError("Formato non supportato. Usa un file .xlsx BBVA.");
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    await parseFile(f);
  };

  const parseFile = async (f: File) => {
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      // Foglio "Historico" (tollerante: anche senza accento o con varianti)
      const sheetName =
        wb.SheetNames.find((n) => /^hist[óo]rico$/i.test(n)) ||
        wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        setError('Foglio "Historico" non trovato nel file.');
        return;
      }
      // Parser BBVA struttura fissa:
      //   - Header alla riga indice 15 (zero-indexed)
      //   - Dati dalla riga 16 in poi
      //   - Colonne (0-indexed): col 2=F.CONTABLE, col 5=CONCEPTO,
      //     col 6=BENEFICIARIO/ORDENANTE, col 7=OBSERVACIONES, col 8=IMPORTE
      //   - IMPORTE negativo = uscita, NaN = riga da saltare
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: false,
        dateNF: "yyyy-mm-dd",
        defval: "",
      });
      const dataRows = aoa.slice(16);

      const cleanText = (v: unknown): string =>
        String(v ?? "")
          .replace(/\s+/g, " ")
          .trim();

      const parsed: ParsedRow[] = [];
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        if (!row || row.length === 0) continue;

        const importeRaw = row[8];
        const imp = parseImporto(importeRaw);
        if (imp === null || isNaN(imp) || imp >= 0) continue; // solo uscite valide

        const iso = toIsoDate(row[2]);
        if (!iso) continue;

        const concepto = cleanText(row[5]);
        const beneficiario = cleanText(row[6]);
        const observaciones = cleanText(row[7]);

        // Fornitore: BENEFICIARIO se valorizzato, altrimenti primi 30 caratteri
        // puliti di OBSERVACIONES, altrimenti CONCEPTO come ultimo fallback
        const fornitore =
          beneficiario || observaciones.slice(0, 30).trim() || concepto || "—";

        const d = new Date(iso);
        parsed.push({
          id: `row-${i}`,
          selected: true,
          data: iso,
          concepto,
          beneficiario,
          fornitore,
          categoria: categorizza(concepto, beneficiario, observaciones),
          importo: Math.abs(imp),
          mese: d.getMonth() + 1,
          anno: d.getFullYear(),
          duplicato: false,
          inSpesaFissa: false,
          spesaFissaInfo: null,
        });
      }

      if (parsed.length === 0) {
        setError("Nessuna uscita trovata nel file.");
        setRows([]);
        return;
      }

      // Carica le SpeseFisse attive per segnalare le righe la cui categoria
      // è già coperta automaticamente dal calcolo SpesaFissa nel bilancio.
      try {
        const res = await fetch("/api/spese-fisse");
        const fisseJson: Array<{
          tipo: string;
          categoria: string | null;
          costoMensile: number;
          attiva: boolean;
        }> = await res.json();
        const fisseAttive = (Array.isArray(fisseJson) ? fisseJson : []).filter(
          (f) => f.attiva,
        );
        // Mappa SpesaFissa.tipo (lowercase) → info string per il tooltip.
        // Matcha solo sul tipo, non su f.categoria, perché diverse SpeseFisse
        // possono condividere la stessa categoria (es. Digi e Ionos sono
        // entrambe "Utenze") e darebbero falsi positivi su tutte le bollette
        // utenze importate da BBVA.
        const fisseByKey = new Map<string, string>();
        for (const f of fisseAttive) {
          const info = `${f.tipo} €${f.costoMensile.toFixed(2)}/mese`;
          if (f.tipo) {
            fisseByKey.set(f.tipo.toLowerCase().trim(), info);
          }
        }
        for (const p of parsed) {
          const info = fisseByKey.get(p.categoria.toLowerCase().trim());
          if (info) {
            p.inSpesaFissa = true;
            p.spesaFissaInfo = info;
            p.selected = false;
          }
        }
      } catch {
        // Se la fetch fallisce non bloccare l'import, prosegui senza warning
      }

      // Dup-check batch
      try {
        const res = await fetch("/api/spese/check-duplicati", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: parsed.map((p) => ({
              fornitore: p.fornitore,
              importo: p.importo,
              mese: p.mese,
              anno: p.anno,
            })),
          }),
        });
        const json = await res.json();
        const dups: boolean[] = Array.isArray(json.duplicati)
          ? json.duplicati
          : [];
        parsed.forEach((p, i) => {
          p.duplicato = !!dups[i];
          if (p.duplicato) p.selected = false;
        });
      } catch {
        // Se il check fallisce, mostriamo comunque le righe (nessun dup marcato)
      }

      setRows(parsed);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (id: string, patch: Partial<ParsedRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        // Se cambia la data, ricalcola mese/anno
        if (patch.data && patch.data !== r.data) {
          const d = new Date(patch.data);
          if (!isNaN(d.getTime())) {
            next.mese = d.getMonth() + 1;
            next.anno = d.getFullYear();
          }
        }
        return next;
      }),
    );
  };

  const toggleAll = (selected: boolean) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        // Seleziona-tutto esclude righe duplicate o già coperte da SpesaFissa.
        // L'utente può comunque attivare il singolo checkbox a mano.
        selected: selected && !r.duplicato && !r.inSpesaFissa,
      })),
    );
  };

  const doImport = async () => {
    const toSend = rows.filter((r) => r.selected);
    if (toSend.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const responses = await Promise.allSettled(
        toSend.map((r) =>
          fetch("/api/spese", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fornitore: r.fornitore,
              categoria: r.categoria,
              importo: r.importo,
              mese: r.mese,
              anno: r.anno,
              data: r.data,
              descrizione: r.concepto || null,
            }),
          }).then(async (res) => {
            if (!res.ok) throw new Error(String(res.status));
            return true;
          }),
        ),
      );
      const imported = responses.filter((r) => r.status === "fulfilled").length;
      const skipped = rows.length - imported;
      setResult({ imported, skipped });
      if (imported > 0) onImported();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const dupCount = rows.filter((r) => r.duplicato).length;
  const fisseCount = rows.filter(
    (r) => r.inSpesaFissa && !r.duplicato,
  ).length;
  const totaleSelezionato = rows
    .filter((r) => r.selected)
    .reduce((s, r) => s + r.importo, 0);

  const busy = parsing || importing;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-5xl p-6 space-y-4 max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5" style={{ color: "#0ea5e9" }} />
            <h2 className="text-lg font-bold text-gray-900">
              Importa da Banca (BBVA)
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!file && !result && (
          <p className="text-xs text-gray-500 flex-shrink-0">
            Carica l&apos;estratto conto (.xlsx) dal foglio &quot;Historico&quot;.
            Verranno mostrate solo le uscite, con categoria assegnata
            automaticamente. Puoi rivedere e modificare prima di importare.
          </p>
        )}

        {/* Drop zone / preview */}
        {!file && !result && (
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              selectFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed px-6 py-12 text-center cursor-pointer transition-all flex-shrink-0"
            style={{
              borderColor: dragActive ? "#0ea5e9" : "#cbd5e1",
              background: dragActive ? "#e0f2fe" : "#f8fafc",
            }}
          >
            <Upload
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: dragActive ? "#0ea5e9" : "#94a3b8" }}
            />
            <p className="text-sm font-semibold text-gray-800">
              Trascina qui il file .xlsx o clicca per selezionarlo
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Formato BBVA — foglio &quot;Historico&quot; · header riga 15
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            selectFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {/* Risultato finale */}
        {result && (
          <div className="rounded-2xl p-6 bg-sky-50 border border-sky-200 text-center space-y-3 flex-shrink-0">
            <CheckCircle2
              className="w-10 h-10 mx-auto"
              style={{ color: "#16a34a" }}
            />
            <div>
              <p className="text-lg font-bold text-gray-900">
                Importazione completata
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {result.imported} importate · {result.skipped} non importate
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  resetAll();
                }}
                className="border border-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-xl hover:bg-white"
              >
                Importa altro file
              </button>
              <button
                onClick={onClose}
                className="glass-btn-primary text-white text-sm font-medium py-2 px-5 rounded-xl"
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        {/* Parsing indicator */}
        {parsing && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 flex-shrink-0">
            <Loader2 className="w-5 h-5 animate-spin" /> Analisi del file in
            corso…
          </div>
        )}

        {/* Tabella preview */}
        {file && !result && rows.length > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0 text-xs text-gray-600">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-700">
                    {file.name}
                  </span>
                </span>
                <span className="text-gray-400">·</span>
                <span>{rows.length} uscite</span>
                {dupCount > 0 && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span
                      className="flex items-center gap-1"
                      style={{ color: "#b45309" }}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {dupCount} già presenti
                    </span>
                  </>
                )}
                {fisseCount > 0 && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span
                      className="flex items-center gap-1"
                      style={{ color: "#b45309" }}
                      title="Categoria coperta da una Spesa Fissa attiva — importarla duplicherebbe l'uscita"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {fisseCount} in Spese Fisse
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      rows.filter((r) => !r.duplicato && !r.inSpesaFissa)
                        .length > 0 &&
                      rows
                        .filter((r) => !r.duplicato && !r.inSpesaFissa)
                        .every((r) => r.selected)
                    }
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="w-4 h-4"
                    style={{ accentColor: "#0ea5e9" }}
                  />
                  <span>Seleziona tutto</span>
                </label>
                <button
                  onClick={resetAll}
                  disabled={busy}
                  className="text-sky-600 hover:text-sky-700 font-medium disabled:opacity-40"
                >
                  Cambia file
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b border-gray-100">
                      {[
                        "",
                        "Data",
                        "Concepto",
                        "Fornitore",
                        "Categoria",
                        "Importo",
                        "Stato",
                      ].map((h, i) => (
                        <th
                          key={h + i}
                          className={`text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2.5 ${h === "Importo" ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-gray-50"
                        style={
                          r.duplicato || r.inSpesaFissa
                            ? { background: "#fefce8" }
                            : undefined
                        }
                        title={
                          r.inSpesaFissa && r.spesaFissaInfo
                            ? `⚠️ Esiste già una Spesa Fissa attiva per questa categoria (${r.spesaFissaInfo}). Importando verrà conteggiata due volte.`
                            : undefined
                        }
                      >
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) =>
                              updateRow(r.id, { selected: e.target.checked })
                            }
                            className="w-4 h-4"
                            style={{ accentColor: "#0ea5e9" }}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            value={r.data}
                            onChange={(e) =>
                              updateRow(r.id, { data: e.target.value })
                            }
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-xs text-gray-600 max-w-[200px] truncate">
                          {r.concepto || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={r.fornitore}
                            onChange={(e) =>
                              updateRow(r.id, { fornitore: e.target.value })
                            }
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={r.categoria}
                            onChange={(e) =>
                              updateRow(r.id, { categoria: e.target.value })
                            }
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                          >
                            {CATEGORIE_SPESA.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={r.importo}
                            onChange={(e) =>
                              updateRow(r.id, {
                                importo: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white font-mono"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          {r.duplicato ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                              title="Spesa con stesso fornitore/importo/mese già nel DB"
                            >
                              <AlertCircle className="w-3 h-3" /> Già presente
                            </span>
                          ) : r.inSpesaFissa ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                              title={
                                r.spesaFissaInfo
                                  ? `⚠️ Esiste già una Spesa Fissa attiva (${r.spesaFissaInfo}). Importando verrà conteggiata due volte.`
                                  : undefined
                              }
                            >
                              <AlertCircle className="w-3 h-3" /> Già in Spese
                              Fisse
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: "#dcfce7",
                                color: "#166534",
                              }}
                            >
                              Nuova
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {error && !result && (
          <div className="rounded-xl p-3 bg-red-50 text-red-800 text-xs flex-shrink-0">
            {error}
          </div>
        )}

        {/* Action bar */}
        {file && !result && rows.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0 pt-1">
            <p className="text-xs text-gray-600">
              {selectedCount} selezionate · totale{" "}
              <span className="font-bold text-gray-900">
                {fmt(totaleSelezionato)}
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={busy}
                className="border border-gray-200 text-gray-600 text-sm font-medium py-2.5 px-5 rounded-xl hover:bg-gray-50 disabled:opacity-40"
              >
                Annulla
              </button>
              <button
                onClick={doImport}
                disabled={busy || selectedCount === 0}
                className="glass-btn-primary text-white text-sm font-medium py-2.5 px-5 rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Importazione…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Importa {selectedCount}{" "}
                    selezionate
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
