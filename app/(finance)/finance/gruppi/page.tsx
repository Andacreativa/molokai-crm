"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Users2,
  School,
  Briefcase,
  Check,
} from "lucide-react";
import { fmt, MESI, ANNI } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface SessioneGruppo {
  id: number;
  gruppoId: number;
  data: string; // ISO
  mese: number;
  anno: number;
  partecipanti: number;
  prezzoPP: number;
  totale: number;
  incassato: boolean;
  note: string | null;
}

interface Gruppo {
  id: number;
  nome: string;
  tipo: string;
  contatto: string | null;
  email: string | null;
  telefono: string | null;
  note: string | null;
  sessioni: SessioneGruppo[];
  totaleIncassato?: number;
  daIncassare?: number;
}

const TIPI_GRUPPO = ["scuola", "azienda", "altro"];
const TIPO_LABEL: Record<string, string> = {
  scuola: "Scuola",
  azienda: "Azienda",
  altro: "Altro",
};
const TIPO_ICON: Record<string, typeof School> = {
  scuola: School,
  azienda: Briefcase,
  altro: Users2,
};
const TIPO_COLOR: Record<string, { bg: string; text: string }> = {
  scuola: { bg: "#e0f2fe", text: "#0369a1" },
  azienda: { bg: "#fef3c7", text: "#92400e" },
  altro: { bg: "#f1f5f9", text: "#475569" },
};

const isoDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function GruppiPage() {
  const [gruppi, setGruppi] = useState<Gruppo[]>([]);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch(`/api/gruppi?anno=${anno}`);
    const data = await res.json();
    setGruppi(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  // Derived: editing/detail get re-found after each load → state riflette i dati freschi
  const editing = editingId
    ? (gruppi.find((g) => g.id === editingId) ?? null)
    : null;
  const detail = detailId
    ? (gruppi.find((g) => g.id === detailId) ?? null)
    : null;

  const sessioniNell_anno = (g: Gruppo) =>
    g.sessioni.filter((s) => s.anno === anno);

  const sessioniFiltrate = (g: Gruppo) =>
    sessioniNell_anno(g).filter(
      (s) => meseFiltro === null || s.mese === meseFiltro,
    );

  // Totali mensili incassati (tutti i gruppi, anno selezionato, solo sessioni incassate)
  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const g of gruppi) {
      for (const s of g.sessioni) {
        if (s.anno === anno && s.incassato) arr[s.mese - 1] += s.totale;
      }
    }
    return arr.map((v) => Math.round(v * 100) / 100);
  }, [gruppi, anno]);
  const totaleAnno = useMemo(
    () => Math.round(totaliMensili.reduce((a, b) => a + b, 0) * 100) / 100,
    [totaliMensili],
  );

  const del = async (id: number) => {
    if (
      !confirm("Eliminare questo gruppo? Verranno rimosse anche le sessioni.")
    )
      return;
    await fetch(`/api/gruppi/${id}`, { method: "DELETE" });
    if (detailId === id) setDetailId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gruppi</h1>
          <p className="text-gray-500 text-sm mt-1">
            Sessioni per scuole, aziende e altri gruppi · anno {anno}
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
              setEditingId(null);
              setShowForm(true);
            }}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Aggiungi Gruppo
          </button>
        </div>
      </div>

      {/* Box riepilogo mensile */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo incassi mensili gruppi
          </h3>
          {meseFiltro !== null && (
            <button
              onClick={() => setMeseFiltro(null)}
              className="text-xs text-gray-500 hover:text-sky-600"
            >
              Rimuovi filtro
            </button>
          )}
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
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Totale {anno}
          </span>
          <span className="text-lg font-bold" style={{ color: "#0ea5e9" }}>
            {fmt(totaleAnno)}
          </span>
        </div>
      </div>

      {/* Tabella gruppi */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Nome",
                  "Tipo",
                  "Contatto",
                  "Email",
                  "N° Sessioni",
                  "Da Incassare",
                  "Totale Incassato",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${
                      ["N° Sessioni", "Da Incassare", "Totale Incassato"].includes(
                        h,
                      )
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {gruppi.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    <Users2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nessun gruppo
                  </td>
                </tr>
              )}
              {gruppi.map((g) => {
                const sessioni = sessioniFiltrate(g);
                const daIncassare = sessioni
                  .filter((s) => !s.incassato)
                  .reduce((s, x) => s + x.totale, 0);
                const totaleGruppo = sessioni
                  .filter((s) => s.incassato)
                  .reduce((s, x) => s + x.totale, 0);
                const tipoColor = TIPO_COLOR[g.tipo] ?? TIPO_COLOR.altro;
                const TipoIcon = TIPO_ICON[g.tipo] ?? Users2;
                return (
                  <tr
                    key={g.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDetailId(g.id)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {g.nome}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          background: tipoColor.bg,
                          color: tipoColor.text,
                        }}
                      >
                        <TipoIcon className="w-3 h-3" />
                        {TIPO_LABEL[g.tipo] ?? g.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {g.contatto ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {g.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {sessioni.length}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{ color: daIncassare > 0 ? "#f59e0b" : "#cbd5e1" }}
                    >
                      {daIncassare > 0 ? fmt(daIncassare) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{ color: "#0ea5e9" }}
                    >
                      {fmt(totaleGruppo)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setEditingId(g.id);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(g.id)}
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
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <GruppoFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {detail && (
        <GruppoDetailModal
          gruppo={detail}
          anno={anno}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditingId(detail.id);
            setDetailId(null);
            setShowForm(true);
          }}
          onChanged={load}
        />
      )}
    </div>
  );
}

// ─── Gruppo Form Modal ─────────────────────────────────────────────────

function GruppoFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Gruppo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: editing?.nome ?? "",
    tipo: editing?.tipo ?? "scuola",
    contatto: editing?.contatto ?? "",
    email: editing?.email ?? "",
    telefono: editing?.telefono ?? "",
    note: editing?.note ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/gruppi/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/gruppi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
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
            {editing ? "Modifica Gruppo" : "Nuovo Gruppo"}
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
              Nome *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Es. Colegio La Salle Barceloneta"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Tipo
            </label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {TIPI_GRUPPO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Contatto
            </label>
            <input
              type="text"
              value={form.contatto}
              onChange={(e) =>
                setForm((f) => ({ ...f, contatto: e.target.value }))
              }
              placeholder="Nome referente"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="info@..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Telefono
            </label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) =>
                setForm((f) => ({ ...f, telefono: e.target.value }))
              }
              placeholder="+34 ..."
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

// ─── Gruppo Detail Modal (con sessioni) ────────────────────────────────

function GruppoDetailModal({
  gruppo,
  anno,
  onClose,
  onEdit,
  onChanged,
}: {
  gruppo: Gruppo;
  anno: number;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [editingSessioneId, setEditingSessioneId] = useState<number | null>(
    null,
  );
  // Default prezzo = ultima sessione per data (la più recente)
  const lastPrezzo =
    gruppo.sessioni.length > 0
      ? [...gruppo.sessioni].sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
        )[0].prezzoPP
      : 0;

  const [form, setForm] = useState({
    data: isoDate(new Date()),
    partecipanti: "",
    prezzoPP: lastPrezzo > 0 ? String(lastPrezzo) : "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  // Quando si seleziona una sessione da modificare, popola la form.
  const editingSessione = editingSessioneId
    ? (gruppo.sessioni.find((s) => s.id === editingSessioneId) ?? null)
    : null;
  useEffect(() => {
    if (editingSessione) {
      setForm({
        data: isoDate(editingSessione.data),
        partecipanti: String(editingSessione.partecipanti),
        prezzoPP: String(editingSessione.prezzoPP),
        note: editingSessione.note ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSessioneId]);

  const resetForm = () => {
    setForm({
      data: isoDate(new Date()),
      partecipanti: "",
      prezzoPP: lastPrezzo > 0 ? String(lastPrezzo) : "",
      note: "",
    });
    setEditingSessioneId(null);
  };

  const partecipanti = parseInt(form.partecipanti) || 0;
  const prezzoPP = parseFloat(form.prezzoPP) || 0;
  const totaleLive = Math.round(partecipanti * prezzoPP * 100) / 100;

  const save = async () => {
    if (partecipanti <= 0 || prezzoPP <= 0 || !form.data) return;
    setSaving(true);
    const payload = {
      data: form.data,
      partecipanti,
      prezzoPP,
      note: form.note,
    };
    try {
      if (editingSessione) {
        await fetch(`/api/gruppi/${gruppo.id}/sessioni/${editingSessione.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/gruppi/${gruppo.id}/sessioni`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const del = async (sessioneId: number) => {
    if (!confirm("Eliminare questa sessione?")) return;
    await fetch(`/api/gruppi/${gruppo.id}/sessioni/${sessioneId}`, {
      method: "DELETE",
    });
    if (editingSessioneId === sessioneId) resetForm();
    onChanged();
  };

  const toggleIncassato = async (s: SessioneGruppo) => {
    await fetch(`/api/gruppi/${gruppo.id}/sessioni/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incassato: !s.incassato }),
    });
    onChanged();
  };

  // Stats: anno selezionato (totale incassato = solo sessioni incassate)
  const sessioniAnno = gruppo.sessioni.filter((s) => s.anno === anno);
  const totaleAnno = sessioniAnno
    .filter((s) => s.incassato)
    .reduce((a, b) => a + b.totale, 0);

  const tipoColor = TIPO_COLOR[gruppo.tipo] ?? TIPO_COLOR.altro;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{gruppo.nome}</h2>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                style={{ background: tipoColor.bg, color: tipoColor.text }}
              >
                {TIPO_LABEL[gruppo.tipo] ?? gruppo.tipo}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {gruppo.contatto ?? "Nessun contatto"}
              {gruppo.email && ` · ${gruppo.email}`}
              {gruppo.telefono && ` · ${gruppo.telefono}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats anno */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Sessioni {anno}
            </p>
            <p className="text-sm font-bold text-gray-900">
              {sessioniAnno.length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Totale incassato {anno}
            </p>
            <p className="text-sm font-bold" style={{ color: "#0ea5e9" }}>
              {fmt(totaleAnno)}
            </p>
          </div>
        </div>

        {/* Form aggiungi/modifica sessione */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            background: editingSessione ? "#fef9c3" : "#f0f9ff",
            borderColor: editingSessione ? "#fde047" : "#bae6fd",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              {editingSessione ? "Modifica sessione" : "Nuova sessione"}
            </h3>
            {editingSessione && (
              <button
                onClick={resetForm}
                className="text-xs text-gray-500 hover:text-sky-600"
              >
                Annulla modifica
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Data
              </label>
              <input
                type="date"
                value={form.data}
                onChange={(e) =>
                  setForm((f) => ({ ...f, data: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Prezzo / pp (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={form.prezzoPP}
                onChange={(e) =>
                  setForm((f) => ({ ...f, prezzoPP: e.target.value }))
                }
                placeholder="14.00"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white text-right"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Partecipanti
              </label>
              <input
                type="number"
                value={form.partecipanti}
                onChange={(e) =>
                  setForm((f) => ({ ...f, partecipanti: e.target.value }))
                }
                placeholder="14"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white text-right"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Totale
              </label>
              <div
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white text-right font-bold"
                style={{ color: "#0ea5e9" }}
              >
                {fmt(totaleLive)}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Note
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Opzionale"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={
                saving || partecipanti <= 0 || prezzoPP <= 0 || !form.data
              }
              className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {editingSessione ? "Salva Modifiche" : "Aggiungi Sessione"}
            </button>
          </div>
        </div>

        {/* Tabella sessioni */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2">
            Sessioni ({gruppo.sessioni.length})
          </h3>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Data",
                    "Partecipanti",
                    "Prezzo/pp",
                    "Totale",
                    "Incassato",
                    "Note",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase ${
                        ["Partecipanti", "Prezzo/pp", "Totale"].includes(h)
                          ? "text-right"
                          : h === "Incassato"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="zebra">
                {gruppo.sessioni.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center text-gray-400 py-6 text-xs italic"
                    >
                      Nessuna sessione registrata
                    </td>
                  </tr>
                )}
                {[...gruppo.sessioni]
                  .sort(
                    (a, b) =>
                      new Date(a.data).getTime() - new Date(b.data).getTime(),
                  )
                  .map((s) => {
                    const isEditing = editingSessioneId === s.id;
                    return (
                      <tr
                        key={s.id}
                        className="border-t border-gray-100"
                        style={
                          isEditing ? { background: "#fef9c3" } : undefined
                        }
                      >
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {new Date(s.data).toLocaleDateString("it-IT")}
                        </td>
                        <td className="px-3 py-2 text-xs text-right">
                          {s.partecipanti}
                        </td>
                        <td className="px-3 py-2 text-xs text-right text-gray-600">
                          {fmt(s.prezzoPP)}
                        </td>
                        <td
                          className="px-3 py-2 text-xs font-bold text-right"
                          style={{ color: "#0ea5e9" }}
                        >
                          {fmt(s.totale)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleIncassato(s)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors"
                            style={
                              s.incassato
                                ? { background: "#dcfce7", color: "#166534" }
                                : { background: "#f1f5f9", color: "#64748b" }
                            }
                            title={
                              s.incassato
                                ? "Clicca per contrassegnare come non incassato"
                                : "Clicca per contrassegnare come incassato"
                            }
                          >
                            {s.incassato ? (
                              <>
                                <Check className="w-3 h-3" /> Sì
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" /> No
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[180px] truncate">
                          {s.note ?? ""}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setEditingSessioneId(s.id)}
                              className="p-1 rounded text-gray-400 hover:text-sky-600 hover:bg-sky-50"
                              title="Modifica"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => del(s.id)}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Elimina"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
            Modifica Gruppo
          </button>
        </div>
      </div>
    </div>
  );
}
