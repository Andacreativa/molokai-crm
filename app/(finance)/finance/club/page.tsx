"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { fmt, MESI, ANNI } from "@/lib/constants";
import { exportPDF, exportExcel } from "@/lib/export";

// ─── Types ────────────────────────────────────────────────────────────────

interface PagamentoMensile {
  id?: number;
  anno: number;
  mese: number;
  pagato: boolean;
  importo: number | null;
  data?: string | null;
}

interface Socio {
  id: number;
  nome: string;
  cognome: string | null;
  dni: string | null;
  cellulare: string | null;
  email: string | null;
  piano: string;
  pianoDescrizione: string | null;
  prezzoPiano: number;
  pagamento: string;
  iban: string | null;
  stato: string;
  matricola: string | null;
  matricolaImporto: number;
  matricolaGratuita: boolean;
  matricolaPagata: boolean;
  matricolaMesePagamento: string | null;
  note: string | null;
  pagamentiMensili: PagamentoMensile[];
}

interface Buono {
  id: number;
  nome: string;
  cognome: string | null;
  cellulare: string | null;
  email: string | null;
  socioId: number | null;
  tipoBuono: string;
  prezzoBuono: number;
  pagato: boolean;
  mesePagamento: string | null;
  stato: string;
  sessioniTotali: number | null;
  sessioniUsate: number;
  note: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────

const PIANI = ["PLAN VARADA", "PLAN MATERIAL", "ANNUALE", "ALTRO"];
// ALTRO: no default price, l'utente inserisce importo + descrizione manualmente.
const PIANI_PREZZI: Record<string, number> = {
  "PLAN VARADA": 60,
  "PLAN MATERIAL": 55,
  ANNUALE: 648,
};
const PAGAMENTI = ["MENSILE", "ANNUALE"];
const STATI_SOCIO = ["ATTIVO", "SOSPESO", "CANCELLATO"];
const STATO_COLORI_SOCIO: Record<string, { bg: string; text: string }> = {
  ATTIVO: { bg: "#dcfce7", text: "#166534" },
  SOSPESO: { bg: "#fef3c7", text: "#92400e" },
  CANCELLATO: { bg: "#fee2e2", text: "#991b1b" },
};

const TIPI_BUONO = ["BONO CLASE", "PACK 4 SUP", "PACK 8 SUP", "CUSTOM"];
const SESSIONI_DEFAULT: Record<string, number | null> = {
  "BONO CLASE": 1,
  "PACK 4 SUP": 4,
  "PACK 8 SUP": 8,
  CUSTOM: null,
};
const STATI_BUONO = ["Attivo", "Usato", "Scaduto"];
const STATO_COLORI_BUONO: Record<string, { bg: string; text: string }> = {
  Attivo: { bg: "#dcfce7", text: "#166534" },
  Usato: { bg: "#e2e8f0", text: "#475569" },
  Scaduto: { bg: "#fee2e2", text: "#991b1b" },
};

const ANNO_CORRENTE = new Date().getFullYear();

// ─── Root Page ────────────────────────────────────────────────────────────

export default function ClubPage() {
  const [tab, setTab] = useState<"soci" | "buoni">("soci");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Club</h1>
        <p className="text-gray-500 text-sm mt-1">
          Soci e buoni del Molokai Surf Club
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["soci", "buoni"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px"
              style={
                active
                  ? { color: "#0ea5e9", borderColor: "#0ea5e9" }
                  : { color: "#64748b", borderColor: "transparent" }
              }
            >
              {t === "soci" ? "Soci" : "Buoni"}
            </button>
          );
        })}
      </div>

      {tab === "soci" ? <SociTab /> : <BuoniTab />}
    </div>
  );
}

// ─── SOCI TAB ─────────────────────────────────────────────────────────────

function SociTab() {
  const [soci, setSoci] = useState<Socio[]>([]);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState("");
  const [pagamentoFilter, setPagamentoFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Socio | null>(null);
  const [detail, setDetail] = useState<Socio | null>(null);

  const load = async () => {
    const res = await fetch("/api/club/soci");
    const data = await res.json();
    setSoci(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    load();
  }, []);

  const q = search.toLowerCase();
  const filtered = soci.filter((s) => {
    if (statoFilter && s.stato !== statoFilter) return false;
    if (pagamentoFilter && s.pagamento !== pagamentoFilter) return false;
    return (
      (s.nome ?? "").toLowerCase().includes(q) ||
      (s.cognome ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.piano ?? "").toLowerCase().includes(q)
    );
  });

  // Stats
  const meseCorrente = new Date().getMonth() + 1;
  const sociAttivi = soci.filter((s) => s.stato === "ATTIVO").length;
  const incassoMeseCorrente = soci.reduce((sum, s) => {
    const p = s.pagamentiMensili?.find(
      (x) => x.anno === ANNO_CORRENTE && x.mese === meseCorrente && x.pagato,
    );
    return sum + (p?.importo ?? (p?.pagato ? s.prezzoPiano : 0));
  }, 0);

  // Riepilogo incassi mensili (anno selezionato)
  const [annoRiepilogo, setAnnoRiepilogo] = useState(ANNO_CORRENTE);
  const anniDisponibili = ANNI;
  const totaliMensili = Array(12).fill(0) as number[];
  for (const s of soci) {
    for (const p of s.pagamentiMensili ?? []) {
      if (p.anno === annoRiepilogo && p.pagato) {
        totaliMensili[p.mese - 1] += p.importo ?? s.prezzoPiano;
      }
    }
    if (s.matricolaPagata && !s.matricolaGratuita && s.matricolaMesePagamento) {
      const lower = s.matricolaMesePagamento.toLowerCase();
      const meseMat = MESI.findIndex((m) => lower.startsWith(m.toLowerCase()));
      const annoMatch = s.matricolaMesePagamento.match(/\d{4}/);
      const annoMat = annoMatch ? parseInt(annoMatch[0]) : null;
      if (meseMat >= 0 && annoMat === annoRiepilogo) {
        totaliMensili[meseMat] += s.matricolaImporto;
      }
    }
  }
  const totaleAnnoRiepilogo = totaliMensili.reduce((a, b) => a + b, 0);

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (s: Socio) => {
    setEditing(s);
    setShowForm(true);
  };
  const del = async (id: number) => {
    if (!confirm("Eliminare questo socio? Verranno rimossi anche i pagamenti."))
      return;
    await fetch(`/api/club/soci/${id}`, { method: "DELETE" });
    if (detail?.id === id) setDetail(null);
    load();
  };

  // ─── Export helpers ──────────────────────────────────────────────────
  const pianoLabel = (s: Socio) =>
    s.piano === "ALTRO" && s.pianoDescrizione
      ? `ALTRO (${s.pianoDescrizione})`
      : s.piano;
  const matricolaLabel = (s: Socio) =>
    s.matricolaGratuita
      ? "Gratuita"
      : s.matricolaPagata
        ? (s.matricolaMesePagamento ?? "Sì")
        : "No";

  const today = new Date().toISOString().slice(0, 10);

  const handleExportPDF = () => {
    const cols = [
      "Nome",
      "Cognome",
      "Piano",
      "Prezzo",
      "Pagamento",
      "Stato",
      "Matricola pagata",
    ];
    const rows = filtered.map((s) => [
      s.nome,
      s.cognome ?? "",
      pianoLabel(s),
      fmt(s.prezzoPiano),
      s.pagamento,
      s.stato,
      matricolaLabel(s),
    ]);
    exportPDF("Soci Molokai", cols, rows, `soci_molokai_${today}`);
  };

  const handleExportExcel = () => {
    const data = filtered.map((s) => ({
      Nome: s.nome,
      Cognome: s.cognome ?? "",
      Piano: pianoLabel(s),
      Prezzo: s.prezzoPiano,
      Pagamento: s.pagamento,
      Stato: s.stato,
      "Matricola pagata": matricolaLabel(s),
    }));
    exportExcel(data, `soci_molokai_${today}`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nome, email, piano..."
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white min-w-[240px]"
          />
          <select
            value={statoFilter}
            onChange={(e) => setStatoFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            <option value="">Tutti gli stati</option>
            {STATI_SOCIO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={pagamentoFilter}
            onChange={(e) => setPagamentoFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            <option value="">Tutti i pagamenti</option>
            <option value="MENSILE">Mensile</option>
            <option value="ANNUALE">Annuale</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPDF}
            disabled={filtered.length === 0}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            title="Esporta lista filtrata in PDF"
          >
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            title="Esporta lista filtrata in Excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={openNew}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Aggiungi Socio
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Soci attivi
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sociAttivi}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Incassato {MESI[meseCorrente - 1]} {ANNO_CORRENTE}
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#0ea5e9" }}>
            {fmt(incassoMeseCorrente)}
          </p>
        </div>
      </div>

      {/* Riepilogo incassi mensili */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo incassi mensili soci
          </h3>
          <select
            value={annoRiepilogo}
            onChange={(e) => setAnnoRiepilogo(parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            {anniDisponibili.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MESI.map((mese, idx) => {
            const tot = totaliMensili[idx];
            const hasValue = tot > 0;
            return (
              <div
                key={mese}
                className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg border"
                style={
                  hasValue
                    ? { background: "#e0f2fe", borderColor: "#7dd3fc" }
                    : { background: "#fff", borderColor: "#e2e8f0" }
                }
              >
                <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">
                  {mese.slice(0, 3)}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: hasValue ? "#0369a1" : "#cbd5e1" }}
                >
                  {hasValue ? fmt(tot).replace(" €", "") : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Totale {annoRiepilogo}
          </span>
          <span className="text-lg font-bold" style={{ color: "#0ea5e9" }}>
            {fmt(totaleAnnoRiepilogo)}
          </span>
        </div>
      </div>

      {/* Tabella */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Nome",
                  "Cognome",
                  "Piano",
                  "Prezzo",
                  "Pagamento",
                  "Stato",
                  "Cellulare",
                  "Email",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === "Prezzo" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    Nessun socio trovato
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const stato =
                  STATO_COLORI_SOCIO[s.stato] ?? STATO_COLORI_SOCIO.ATTIVO;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDetail(s)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {s.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {s.cognome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {s.piano}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {fmt(s.prezzoPiano)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.pagamento}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: stato.bg, color: stato.text }}
                      >
                        {s.stato}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {s.cellulare ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {s.email ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          aria-label="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(s.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Elimina"
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

      {detail && (
        <SocioDetailModal
          socio={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const s = detail;
            setDetail(null);
            openEdit(s);
          }}
          onReload={load}
        />
      )}

      {showForm && (
        <SocioFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── SOCIO FORM MODAL ─────────────────────────────────────────────────────

function SocioFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Socio | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: editing?.nome ?? "",
    cognome: editing?.cognome ?? "",
    dni: editing?.dni ?? "",
    cellulare: editing?.cellulare ?? "",
    email: editing?.email ?? "",
    piano: editing?.piano ?? "PLAN VARADA",
    pianoDescrizione: editing?.pianoDescrizione ?? "",
    prezzoPiano: String(editing?.prezzoPiano ?? 0),
    pagamento: editing?.pagamento ?? "MENSILE",
    iban: editing?.iban ?? "",
    stato: editing?.stato ?? "ATTIVO",
    matricola: editing?.matricola ?? "",
    matricolaImporto: String(editing?.matricolaImporto ?? 50),
    matricolaGratuita: editing?.matricolaGratuita ?? false,
    matricolaPagata: editing?.matricolaPagata ?? false,
    matricolaMesePagamento: editing?.matricolaMesePagamento ?? "",
    note: editing?.note ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      prezzoPiano: parseFloat(form.prezzoPiano) || 0,
      // Descrizione piano rilevante solo per "ALTRO", altrimenti null
      pianoDescrizione:
        form.piano === "ALTRO" ? form.pianoDescrizione || null : null,
      matricolaImporto: form.matricolaGratuita
        ? 0
        : parseFloat(form.matricolaImporto) || 0,
      matricolaMesePagamento: form.matricolaPagata
        ? form.matricolaMesePagamento || null
        : null,
    };
    try {
      if (editing) {
        await fetch(`/api/club/soci/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/club/soci", {
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

  const Input = (
    k: keyof typeof form,
    label: string,
    placeholder = "",
    type = "text",
  ) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
    </div>
  );

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
            {editing ? "Modifica Socio" : "Nuovo Socio"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Input("nome", "Nome *", "Mario")}
          {Input("cognome", "Cognome", "Rossi")}
          {Input("dni", "DNI / NIE", "X1234567Y")}
          {Input("matricola", "Matricola", "M-001")}
          {Input("cellulare", "Cellulare", "+34 600...")}
          {Input("email", "Email", "info@...", "email")}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Piano
            </label>
            <select
              value={form.piano}
              onChange={(e) => {
                const nuovoPiano = e.target.value;
                setForm((f) => ({
                  ...f,
                  piano: nuovoPiano,
                  prezzoPiano: String(
                    PIANI_PREZZI[nuovoPiano] ?? f.prezzoPiano,
                  ),
                }));
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {PIANI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {Input("prezzoPiano", "Prezzo piano (€)", "50", "number")}

          {form.piano === "ALTRO" && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Descrizione piano *
              </label>
              <input
                type="text"
                value={form.pianoDescrizione}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pianoDescrizione: e.target.value }))
                }
                placeholder="Es. Nuotatore - materiale ridotto"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Pagamento
            </label>
            <select
              value={form.pagamento}
              onChange={(e) =>
                setForm((f) => ({ ...f, pagamento: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {PAGAMENTI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Stato
            </label>
            <select
              value={form.stato}
              onChange={(e) =>
                setForm((f) => ({ ...f, stato: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {STATI_SOCIO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              IBAN
            </label>
            <input
              type="text"
              value={form.iban}
              onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
              placeholder="ES91 ..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 font-mono"
            />
          </div>

          <div className="col-span-2 border-t border-gray-200 pt-4 mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Matricola
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Importo (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.matricolaImporto}
                  disabled={form.matricolaGratuita}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, matricolaImporto: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 cursor-pointer py-2">
                  <input
                    type="checkbox"
                    checked={form.matricolaGratuita}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        matricolaGratuita: e.target.checked,
                        matricolaImporto: e.target.checked
                          ? "0"
                          : f.matricolaImporto,
                      }))
                    }
                    className="w-4 h-4"
                    style={{ accentColor: "#0ea5e9" }}
                  />
                  <span className="text-sm text-gray-700">
                    Matricola gratuita
                  </span>
                </label>
              </div>
              <div>
                <label className="inline-flex items-center gap-2 cursor-pointer py-2">
                  <input
                    type="checkbox"
                    checked={form.matricolaPagata}
                    disabled={form.matricolaGratuita}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        matricolaPagata: e.target.checked,
                      }))
                    }
                    className="w-4 h-4"
                    style={{ accentColor: "#0ea5e9" }}
                  />
                  <span className="text-sm text-gray-700 font-medium">
                    Pagata
                  </span>
                </label>
              </div>
              {form.matricolaPagata && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Mese pagamento
                  </label>
                  <input
                    type="text"
                    value={form.matricolaMesePagamento}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        matricolaMesePagamento: e.target.value,
                      }))
                    }
                    placeholder="Es. Gennaio 2026"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
              )}
            </div>
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
            disabled={saving || !form.nome.trim()}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SOCIO DETAIL MODAL ───────────────────────────────────────────────────

function SocioDetailModal({
  socio: initialSocio,
  onClose,
  onEdit,
  onReload,
}: {
  socio: Socio;
  onClose: () => void;
  onEdit: () => void;
  onReload: () => void;
}) {
  const [socio, setSocio] = useState<Socio>(initialSocio);
  const [anno, setAnno] = useState(ANNO_CORRENTE);
  const [saving, setSaving] = useState<string | null>(null);

  const isAnnuale = socio.pagamento === "ANNUALE";
  const pagamenti = socio.pagamentiMensili ?? [];

  const pagamentoDi = (mese: number) =>
    pagamenti.find((p) => p.anno === anno && p.mese === mese);

  // Per soci annuali: il mese già pagato (se esiste) blocca gli altri.
  const meseAnnualePagato = isAnnuale
    ? (pagamenti.find((p) => p.anno === anno && p.pagato)?.mese ?? null)
    : null;

  const togglePagato = async (mese: number) => {
    const p = pagamentoDi(mese);
    const current = p?.pagato ?? false;
    const pagato = !current;
    setSaving(`m-${mese}`);
    try {
      const res = await fetch(`/api/club/soci/${socio.id}/pagamenti`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anno,
          mese,
          pagato,
          importo: pagato ? socio.prezzoPiano : null,
        }),
      });
      const updated = (await res.json()) as Socio;
      if (updated?.id) setSocio(updated);
      onReload();
    } finally {
      setSaving(null);
    }
  };

  const saveMatricola = async (patch: {
    pagata?: boolean;
    mesePagamento?: string | null;
    importo?: number;
  }) => {
    setSaving("matr");
    try {
      const body = {
        tipo: "matricola",
        pagata: patch.pagata ?? socio.matricolaPagata,
        mesePagamento:
          patch.mesePagamento !== undefined
            ? patch.mesePagamento
            : socio.matricolaMesePagamento,
        ...(patch.importo !== undefined ? { importo: patch.importo } : {}),
      };
      const res = await fetch(`/api/club/soci/${socio.id}/pagamenti`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const updated = (await res.json()) as Socio;
      if (updated?.id) setSocio(updated);
      onReload();
    } finally {
      setSaving(null);
    }
  };

  // Totale anno = mesi pagati anno + matricola (se pagata e mese appartiene all'anno)
  const mesiPagatiAnno = pagamenti.filter((p) => p.anno === anno && p.pagato);
  const totalePagamenti = mesiPagatiAnno.reduce(
    (sum, p) => sum + (p.importo ?? socio.prezzoPiano),
    0,
  );
  const matricolaInAnno =
    socio.matricolaPagata &&
    !socio.matricolaGratuita &&
    (!socio.matricolaMesePagamento ||
      socio.matricolaMesePagamento.includes(String(anno)));
  const totaleMatricola = matricolaInAnno ? socio.matricolaImporto : 0;
  const totaleAnno = totalePagamenti + totaleMatricola;

  const stato = STATO_COLORI_SOCIO[socio.stato] ?? STATO_COLORI_SOCIO.ATTIVO;
  const anniDisponibili = ANNI;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-4xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">
                {socio.nome} {socio.cognome ?? ""}
              </h2>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ background: stato.bg, color: stato.text }}
              >
                {socio.stato}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {socio.piano === "ALTRO" && socio.pianoDescrizione
                ? `${socio.piano} (${socio.pianoDescrizione})`
                : socio.piano}{" "}
              · {fmt(socio.prezzoPiano)} · {socio.pagamento}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anagrafica */}
        <div className="bg-white/60 rounded-xl p-4 space-y-2">
          <DetailRow label="DNI / NIE" value={socio.dni} />
          <DetailRow label="Matricola" value={socio.matricola} />
          <DetailRow label="Cellulare" value={socio.cellulare} />
          <DetailRow label="Email" value={socio.email} />
          <DetailRow label="IBAN" value={socio.iban} mono />
          {socio.note && <DetailRow label="Note" value={socio.note} />}
        </div>

        {/* Year selector */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Pagamenti</h3>
          <select
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            {anniDisponibili.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Matricola row */}
        <div className="rounded-xl border border-gray-200 p-3 bg-white/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
                  Matricola
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {socio.matricolaGratuita
                    ? "Gratuita"
                    : fmt(socio.matricolaImporto)}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={socio.matricolaPagata}
                  disabled={socio.matricolaGratuita || saving === "matr"}
                  onChange={() =>
                    saveMatricola({ pagata: !socio.matricolaPagata })
                  }
                  className="w-4 h-4"
                  style={{ accentColor: "#0ea5e9" }}
                />
                <span className="text-sm text-gray-700 font-medium">
                  Pagata
                </span>
              </label>
            </div>
            {socio.matricolaPagata && (
              <input
                type="text"
                defaultValue={socio.matricolaMesePagamento ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (socio.matricolaMesePagamento ?? "")) {
                    saveMatricola({ mesePagamento: v || null });
                  }
                }}
                placeholder="Es. Gennaio 2026"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 w-48"
              />
            )}
          </div>
        </div>

        {/* 12-column payments grid */}
        <div>
          <div className="grid grid-cols-12 gap-1">
            {MESI.map((mese, idx) => {
              const m = idx + 1;
              const p = pagamentoDi(m);
              const pagato = p?.pagato ?? false;
              const loading = saving === `m-${m}`;
              const disabled =
                isAnnuale &&
                meseAnnualePagato !== null &&
                meseAnnualePagato !== m;
              const importoLabel = isAnnuale
                ? pagato
                  ? fmt(p?.importo ?? socio.prezzoPiano)
                  : ""
                : fmt(socio.prezzoPiano);

              return (
                <button
                  key={m}
                  onClick={() => togglePagato(m)}
                  disabled={loading || disabled}
                  className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg border text-[10px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={
                    pagato
                      ? {
                          background: "#dcfce7",
                          color: "#166534",
                          borderColor: "#86efac",
                        }
                      : {
                          background: "#fff",
                          color: "#64748b",
                          borderColor: "#e2e8f0",
                        }
                  }
                >
                  <span className="uppercase tracking-wide">
                    {mese.slice(0, 3)}
                  </span>
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded border"
                    style={
                      pagato
                        ? { background: "#22c55e", borderColor: "#22c55e" }
                        : { borderColor: "#cbd5e1" }
                    }
                  >
                    {pagato && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="text-[9px] text-gray-500 font-medium h-3">
                    {importoLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {isAnnuale && meseAnnualePagato === null && (
            <p className="text-[11px] text-gray-500 mt-2">
              Piano annuale: clicca sul mese in cui è stato effettuato il
              pagamento.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4 bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                {isAnnuale ? "Pagamento anno" : "Mesi pagati"} {anno}
              </p>
              <p className="text-sm font-bold text-gray-900">
                {isAnnuale
                  ? meseAnnualePagato
                    ? `✓ ${MESI[meseAnnualePagato - 1]}`
                    : "—"
                  : `${mesiPagatiAnno.length} / 12`}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                Incassato {anno}
              </p>
              <p className="text-sm font-bold" style={{ color: "#0ea5e9" }}>
                {fmt(totaleAnno)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {fmt(totalePagamenti)} quote
                {matricolaInAnno ? ` + ${fmt(totaleMatricola)} matricola` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50"
          >
            Chiudi
          </button>
          <button
            onClick={onEdit}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl"
          >
            Modifica Socio
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-sm text-gray-800 break-words ${mono ? "font-mono" : ""}`}
      >
        {value || <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}

// ─── BUONI TAB ────────────────────────────────────────────────────────────

function BuoniTab() {
  const [buoni, setBuoni] = useState<Buono[]>([]);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Buono | null>(null);

  const load = async () => {
    const res = await fetch("/api/club/buoni");
    const data = await res.json();
    setBuoni(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    load();
  }, []);

  const q = search.toLowerCase();
  const filtered = buoni.filter((b) => {
    if (statoFilter && b.stato !== statoFilter) return false;
    return (
      (b.nome ?? "").toLowerCase().includes(q) ||
      (b.cognome ?? "").toLowerCase().includes(q) ||
      (b.tipoBuono ?? "").toLowerCase().includes(q) ||
      (b.email ?? "").toLowerCase().includes(q)
    );
  });

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (b: Buono) => {
    setEditing(b);
    setShowForm(true);
  };
  const del = async (id: number) => {
    if (!confirm("Eliminare questo buono?")) return;
    await fetch(`/api/club/buoni/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nome, tipo, email..."
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white min-w-[240px]"
          />
          <select
            value={statoFilter}
            onChange={(e) => setStatoFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            <option value="">Tutti gli stati</option>
            {STATI_BUONO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={openNew}
          className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
        >
          <Plus className="w-4 h-4" /> Aggiungi Buono
        </button>
      </div>

      {/* Tabella */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Nome",
                  "Cognome",
                  "Tipo Bono",
                  "Prezzo",
                  "Pagato",
                  "Stato",
                  "Sessioni Residue",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === "Prezzo" || h === "Sessioni Residue" ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    Nessun buono trovato
                  </td>
                </tr>
              )}
              {filtered.map((b) => {
                const stato =
                  STATO_COLORI_BUONO[b.stato] ?? STATO_COLORI_BUONO.Attivo;
                const residue =
                  b.sessioniTotali !== null
                    ? Math.max(0, b.sessioniTotali - b.sessioniUsate)
                    : null;
                return (
                  <tr
                    key={b.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(b)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {b.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {b.cognome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {b.tipoBuono}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {fmt(b.prezzoBuono)}
                    </td>
                    <td className="px-4 py-3">
                      {b.pagato ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: "#dcfce7", color: "#166534" }}
                        >
                          <Check className="w-3 h-3" /> Sì
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          <X className="w-3 h-3" /> No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: stato.bg, color: stato.text }}
                      >
                        {b.stato}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {residue !== null
                        ? `${residue} / ${b.sessioniTotali}`
                        : "—"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          aria-label="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(b.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Elimina"
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
        <BuonoFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── BUONO FORM MODAL ─────────────────────────────────────────────────────

function BuonoFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Buono | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: editing?.nome ?? "",
    cognome: editing?.cognome ?? "",
    cellulare: editing?.cellulare ?? "",
    email: editing?.email ?? "",
    tipoBuono: editing?.tipoBuono ?? "BONO CLASE",
    prezzoBuono: String(editing?.prezzoBuono ?? 0),
    pagato: editing?.pagato ?? false,
    mesePagamento: editing?.mesePagamento ?? "",
    stato: editing?.stato ?? "Attivo",
    sessioniTotali: String(
      editing?.sessioniTotali ?? SESSIONI_DEFAULT["BONO CLASE"] ?? "",
    ),
    sessioniUsate: String(editing?.sessioniUsate ?? 0),
    note: editing?.note ?? "",
  });
  const [saving, setSaving] = useState(false);

  // Auto-set sessioni when tipo changes (only for new buoni)
  const onTipoChange = (tipo: string) => {
    setForm((f) => {
      const next = { ...f, tipoBuono: tipo };
      if (!editing) {
        const def = SESSIONI_DEFAULT[tipo];
        next.sessioniTotali =
          def !== null && def !== undefined ? String(def) : "";
      }
      return next;
    });
  };

  const save = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      prezzoBuono: parseFloat(form.prezzoBuono) || 0,
      sessioniTotali:
        form.sessioniTotali === "" ? null : parseInt(form.sessioniTotali),
      sessioniUsate: parseInt(form.sessioniUsate) || 0,
    };
    try {
      if (editing) {
        await fetch(`/api/club/buoni/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/club/buoni", {
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

  const Input = (
    k: keyof typeof form,
    label: string,
    placeholder = "",
    type = "text",
  ) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[k] as string}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
    </div>
  );

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
            {editing ? "Modifica Buono" : "Nuovo Buono"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Input("nome", "Nome *", "Mario")}
          {Input("cognome", "Cognome", "Rossi")}
          {Input("cellulare", "Cellulare", "+34 600...")}
          {Input("email", "Email", "info@...", "email")}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Tipo Bono
            </label>
            <select
              value={form.tipoBuono}
              onChange={(e) => onTipoChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {TIPI_BUONO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {Input("prezzoBuono", "Prezzo (€)", "40", "number")}

          {Input("sessioniTotali", "Sessioni totali", "4", "number")}
          {Input("sessioniUsate", "Sessioni usate", "0", "number")}

          <div className="col-span-2 flex items-center gap-4 flex-wrap">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pagato}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pagato: e.target.checked }))
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: "#0ea5e9" }}
              />
              <span className="text-sm text-gray-700">Pagato</span>
            </label>
            {Input("mesePagamento", "Mese pagamento", "Aprile 2026")}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Stato
            </label>
            <select
              value={form.stato}
              onChange={(e) =>
                setForm((f) => ({ ...f, stato: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {STATI_BUONO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
            disabled={saving || !form.nome.trim()}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}
