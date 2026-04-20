"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, Briefcase } from "lucide-react";
import { fmt, MESI, ANNI, RUOLI_COLLABORATORE } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface Tariffa {
  id: number;
  collaboratoreId: number;
  tipoAttivita: string;
  tariffaOraria: number;
}

interface SessioneColl {
  id: number;
  collaboratoreId: number;
  data: string;
  mese: number;
  anno: number;
  tipoAttivita: string;
  ore: number;
  costo: number;
  note: string | null;
}

interface PagamentoColl {
  id: number;
  collaboratoreId: number;
  anno: number;
  mese: number;
  dovuto: number;
  pagato: number;
  data: string | null;
  note: string | null;
}

interface AnticipoColl {
  id: number;
  collaboratoreId: number;
  mese: string;
  importo: number;
  restituito: boolean;
}

interface Collaboratore {
  id: number;
  nome: string;
  cognome: string | null;
  dni: string | null;
  cellulare: string | null;
  email: string | null;
  iban: string | null;
  ruolo: string;
  note: string | null;
  attivo: boolean;
  tariffe: Tariffa[];
  sessioni: SessioneColl[];
  pagamenti: PagamentoColl[];
  anticipi: AnticipoColl[];
}

const isoDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Page ──────────────────────────────────────────────────────────────

export default function CollaboratoriPage() {
  const [collab, setCollab] = useState<Collaboratore[]>([]);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch("/api/collaboratori");
    const data = await res.json();
    setCollab(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    load();
  }, []);

  const editing = editingId
    ? (collab.find((c) => c.id === editingId) ?? null)
    : null;
  const detail = detailId
    ? (collab.find((c) => c.id === detailId) ?? null)
    : null;

  // Stats per collaboratore (anno selezionato)
  const stats = (c: Collaboratore) => {
    const sessAnno = c.sessioni.filter((s) => s.anno === anno);
    const pagAnno = c.pagamenti.filter((p) => p.anno === anno);
    const dovuto = round2(sessAnno.reduce((s, x) => s + x.costo, 0));
    const pagato = round2(pagAnno.reduce((s, x) => s + x.pagato, 0));
    return { dovuto, pagato, daPagare: round2(dovuto - pagato) };
  };

  // Riepilogo mensile globale (somma pagato di tutti i collaboratori)
  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const c of collab) {
      for (const p of c.pagamenti) {
        if (p.anno === anno) arr[p.mese - 1] += p.pagato;
      }
    }
    return arr.map((v) => round2(v));
  }, [collab, anno]);
  const totaleAnno = useMemo(
    () => round2(totaliMensili.reduce((a, b) => a + b, 0)),
    [totaliMensili],
  );

  const del = async (id: number) => {
    if (
      !confirm(
        "Eliminare questo collaboratore? Verranno rimossi tariffe, sessioni, pagamenti, anticipi.",
      )
    )
      return;
    await fetch(`/api/collaboratori/${id}`, { method: "DELETE" });
    if (detailId === id) setDetailId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collaboratori</h1>
          <p className="text-gray-500 text-sm mt-1">
            Monitor / istruttori freelance · anno {anno}
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
            <Plus className="w-4 h-4" /> Aggiungi Collaboratore
          </button>
        </div>
      </div>

      {/* Box riepilogo mensile (pagamenti totali tutti i collaboratori) */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo pagamenti mensili collaboratori
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

      {/* Tabella collaboratori */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Nome",
                  "Cognome",
                  "Ruolo",
                  "Dovuto",
                  "Pagato",
                  "Da Pagare",
                  "Stato",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${
                      ["Dovuto", "Pagato", "Da Pagare"].includes(h)
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
              {collab.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nessun collaboratore
                  </td>
                </tr>
              )}
              {collab.map((c) => {
                const s = stats(c);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDetailId(c.id)}
                    style={c.attivo ? undefined : { opacity: 0.55 }}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {c.nome}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {c.cognome ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {c.ruolo}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {fmt(s.dovuto)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-semibold text-right"
                      style={{ color: "#22c55e" }}
                    >
                      {fmt(s.pagato)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{ color: s.daPagare > 0 ? "#f59e0b" : "#9ca3af" }}
                    >
                      {fmt(s.daPagare)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={
                          c.attivo
                            ? { background: "#dcfce7", color: "#166534" }
                            : { background: "#fee2e2", color: "#991b1b" }
                        }
                      >
                        {c.attivo ? "Attivo" : "Non attivo"}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(c.id)}
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
        <CollaboratoreFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {detail && (
        <CollaboratoreDetailModal
          collab={detail}
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

// ─── Form Modal (anagrafica + tariffe) ─────────────────────────────────

function CollaboratoreFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Collaboratore | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: editing?.nome ?? "",
    cognome: editing?.cognome ?? "",
    dni: editing?.dni ?? "",
    cellulare: editing?.cellulare ?? "",
    email: editing?.email ?? "",
    iban: editing?.iban ?? "",
    ruolo: editing?.ruolo ?? RUOLI_COLLABORATORE[0],
    note: editing?.note ?? "",
    attivo: editing?.attivo ?? true,
  });
  const [tariffe, setTariffe] = useState<
    Array<{ tipoAttivita: string; tariffaOraria: string }>
  >(
    editing?.tariffe.map((t) => ({
      tipoAttivita: t.tipoAttivita,
      tariffaOraria: String(t.tariffaOraria),
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);

  const addTariffa = () =>
    setTariffe((t) => [...t, { tipoAttivita: "", tariffaOraria: "" }]);
  const updateTariffa = (
    i: number,
    field: "tipoAttivita" | "tariffaOraria",
    val: string,
  ) =>
    setTariffe((t) =>
      t.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)),
    );
  const removeTariffa = (i: number) =>
    setTariffe((t) => t.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.nome.trim() || !form.ruolo) return;
    setSaving(true);
    const payload = {
      ...form,
      tariffe: tariffe.filter((t) => t.tipoAttivita.trim()),
    };
    try {
      if (editing) {
        await fetch(`/api/collaboratori/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/collaboratori", {
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
        className="glass-modal rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? "Modifica Collaboratore" : "Nuovo Collaboratore"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Nome *
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Cognome
            </label>
            <input
              type="text"
              value={form.cognome}
              onChange={(e) =>
                setForm((f) => ({ ...f, cognome: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              DNI / NIE
            </label>
            <input
              type="text"
              value={form.dni}
              onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Cellulare
            </label>
            <input
              type="tel"
              value={form.cellulare}
              onChange={(e) =>
                setForm((f) => ({ ...f, cellulare: e.target.value }))
              }
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
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Ruolo *
            </label>
            <select
              value={form.ruolo}
              onChange={(e) =>
                setForm((f) => ({ ...f, ruolo: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {RUOLI_COLLABORATORE.map((r) => (
                <option key={r} value={r}>
                  {r}
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

          {/* Tariffe management */}
          <div className="col-span-2 border-t border-gray-200 pt-4 mt-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Tariffe
              </label>
              <button
                type="button"
                onClick={addTariffa}
                className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Aggiungi tariffa
              </button>
            </div>
            <div className="space-y-2">
              {tariffe.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  Nessuna tariffa configurata
                </p>
              )}
              {tariffe.map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_120px_32px] gap-2 items-center"
                >
                  <input
                    type="text"
                    value={t.tipoAttivita}
                    onChange={(e) =>
                      updateTariffa(i, "tipoAttivita", e.target.value)
                    }
                    placeholder="Es. Classe Gruppo"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={t.tariffaOraria}
                    onChange={(e) =>
                      updateTariffa(i, "tariffaOraria", e.target.value)
                    }
                    placeholder="€/ora"
                    className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeTariffa(i)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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

          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.attivo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, attivo: e.target.checked }))
                }
                className="w-4 h-4"
                style={{ accentColor: "#0ea5e9" }}
              />
              <span className="text-sm text-gray-700 font-medium">Attivo</span>
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
            disabled={saving || !form.nome.trim() || !form.ruolo}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal (tabs: Profilo / Sessioni / Pagamenti) ──────────────

type DetailTab = "profilo" | "sessioni" | "pagamenti";

function CollaboratoreDetailModal({
  collab,
  anno,
  onClose,
  onEdit,
  onChanged,
}: {
  collab: Collaboratore;
  anno: number;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("sessioni");

  const sessAnno = collab.sessioni.filter((s) => s.anno === anno);
  const dovutoAnno = round2(sessAnno.reduce((a, b) => a + b.costo, 0));
  const pagatoAnno = round2(
    collab.pagamenti
      .filter((p) => p.anno === anno)
      .reduce((a, b) => a + b.pagato, 0),
  );
  const daPagare = round2(dovutoAnno - pagatoAnno);

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
                {collab.nome} {collab.cognome ?? ""}
              </h2>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={
                  collab.attivo
                    ? { background: "#dcfce7", color: "#166534" }
                    : { background: "#fee2e2", color: "#991b1b" }
                }
              >
                {collab.attivo ? "Attivo" : "Non attivo"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{collab.ruolo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3">
          <Stat label={`Dovuto ${anno}`} value={fmt(dovutoAnno)} />
          <Stat label="Pagato" value={fmt(pagatoAnno)} color="#22c55e" />
          <Stat
            label="Da pagare"
            value={fmt(daPagare)}
            color={daPagare > 0 ? "#f59e0b" : "#9ca3af"}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(
            [
              ["sessioni", "Sessioni"],
              ["pagamenti", "Pagamenti & Anticipi"],
              ["profilo", "Profilo & Tariffe"],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-4 py-2 text-sm font-semibold transition-all border-b-2 -mb-px"
                style={
                  active
                    ? { color: "#0ea5e9", borderColor: "#0ea5e9" }
                    : { color: "#64748b", borderColor: "transparent" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "sessioni" && (
          <SessioniTab collab={collab} anno={anno} onChanged={onChanged} />
        )}
        {tab === "pagamenti" && (
          <PagamentiTab collab={collab} anno={anno} onChanged={onChanged} />
        )}
        {tab === "profilo" && <ProfiloTab collab={collab} />}

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
            Modifica Collaboratore
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sessioni Tab ──────────────────────────────────────────────────────

function SessioniTab({
  collab,
  anno,
  onChanged,
}: {
  collab: Collaboratore;
  anno: number;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const tipiDisponibili = collab.tariffe.map((t) => t.tipoAttivita);
  const defaultTipo = tipiDisponibili[0] ?? "";

  const [form, setForm] = useState({
    data: isoDate(new Date()),
    tipoAttivita: defaultTipo,
    ore: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const editingSessione = editingId
    ? (collab.sessioni.find((s) => s.id === editingId) ?? null)
    : null;
  useEffect(() => {
    if (editingSessione) {
      setForm({
        data: isoDate(editingSessione.data),
        tipoAttivita: editingSessione.tipoAttivita,
        ore: String(editingSessione.ore),
        note: editingSessione.note ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  const resetForm = () => {
    setForm({
      data: isoDate(new Date()),
      tipoAttivita: defaultTipo,
      ore: "",
      note: "",
    });
    setEditingId(null);
  };

  const tariffaSel = collab.tariffe.find(
    (t) => t.tipoAttivita === form.tipoAttivita,
  );
  const ore = parseFloat(form.ore) || 0;
  const costoLive = round2(ore * (tariffaSel?.tariffaOraria ?? 0));

  const save = async () => {
    if (!form.tipoAttivita || ore <= 0 || !form.data) return;
    setSaving(true);
    const payload = {
      data: form.data,
      tipoAttivita: form.tipoAttivita,
      ore,
      note: form.note,
    };
    try {
      if (editingSessione) {
        await fetch(
          `/api/collaboratori/${collab.id}/sessioni/${editingSessione.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
      } else {
        await fetch(`/api/collaboratori/${collab.id}/sessioni`, {
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

  const del = async (sId: number) => {
    if (!confirm("Eliminare questa sessione?")) return;
    await fetch(`/api/collaboratori/${collab.id}/sessioni/${sId}`, {
      method: "DELETE",
    });
    if (editingId === sId) resetForm();
    onChanged();
  };

  // Riepilogo mensile sessioni (anno selezionato)
  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const s of collab.sessioni) {
      if (s.anno === anno) arr[s.mese - 1] += s.costo;
    }
    return arr.map((v) => round2(v));
  }, [collab.sessioni, anno]);

  const sessioniAnno = [...collab.sessioni]
    .filter((s) => s.anno === anno)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  return (
    <div className="space-y-4">
      {/* Form add/edit */}
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
        {tipiDisponibili.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded">
            ⚠️ Nessuna tariffa configurata. Aggiungile dal tab &ldquo;Profilo
            &amp; Tariffe&rdquo; prima di registrare sessioni.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Data
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Tipo attività
            </label>
            <select
              value={form.tipoAttivita}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipoAttivita: e.target.value }))
              }
              disabled={tipiDisponibili.length === 0}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white disabled:bg-gray-50"
            >
              {tipiDisponibili.map((t) => {
                const tariffa = collab.tariffe.find(
                  (x) => x.tipoAttivita === t,
                );
                return (
                  <option key={t} value={t}>
                    {t} ({fmt(tariffa?.tariffaOraria ?? 0)}/h)
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Ore
            </label>
            <input
              type="number"
              step="0.5"
              value={form.ore}
              onChange={(e) => setForm((f) => ({ ...f, ore: e.target.value }))}
              placeholder="2"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white text-right"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Costo
            </label>
            <div
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white text-right font-bold"
              style={{ color: "#0ea5e9" }}
            >
              {fmt(costoLive)}
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving || !form.tipoAttivita || ore <= 0 || !form.data}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {editingSessione ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>

      {/* Riepilogo mensile */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
        {MESI.map((m, i) => {
          const tot = totaliMensili[i];
          const has = tot > 0;
          return (
            <div
              key={m}
              className="flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-center"
              style={
                has
                  ? { background: "#e0f2fe", borderColor: "#7dd3fc" }
                  : { background: "#fff", borderColor: "#e2e8f0" }
              }
            >
              <span className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold">
                {m.slice(0, 3)}
              </span>
              <span
                className="text-[10px] font-bold"
                style={{ color: has ? "#0369a1" : "#cbd5e1" }}
              >
                {has ? fmt(tot) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tabella sessioni */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Data", "Tipo", "Ore", "Costo", "Note", ""].map((h) => (
                <th
                  key={h}
                  className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase ${
                    ["Ore", "Costo"].includes(h) ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="zebra">
            {sessioniAnno.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-gray-400 py-6 text-xs italic"
                >
                  Nessuna sessione per {anno}
                </td>
              </tr>
            )}
            {sessioniAnno.map((s) => (
              <tr
                key={s.id}
                className="border-t border-gray-100"
                style={
                  editingId === s.id ? { background: "#fef9c3" } : undefined
                }
              >
                <td className="px-3 py-2 text-xs text-gray-700">
                  {new Date(s.data).toLocaleDateString("it-IT")}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {s.tipoAttivita}
                </td>
                <td className="px-3 py-2 text-xs text-right">{s.ore}</td>
                <td
                  className="px-3 py-2 text-xs font-bold text-right"
                  style={{ color: "#0ea5e9" }}
                >
                  {fmt(s.costo)}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 max-w-[180px] truncate">
                  {s.note ?? ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => setEditingId(s.id)}
                      className="p-1 rounded text-gray-400 hover:text-sky-600 hover:bg-sky-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => del(s.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagamenti & Anticipi Tab ──────────────────────────────────────────

function PagamentiTab({
  collab,
  anno,
  onChanged,
}: {
  collab: Collaboratore;
  anno: number;
  onChanged: () => void;
}) {
  const [savingMese, setSavingMese] = useState<number | null>(null);

  // Per ogni mese: dovuto da sessioni, pagato da DB
  const dovutoPerMese = (m: number) => {
    return round2(
      collab.sessioni
        .filter((s) => s.anno === anno && s.mese === m)
        .reduce((a, b) => a + b.costo, 0),
    );
  };
  const pagatoPerMese = (m: number) => {
    const p = collab.pagamenti.find((p) => p.anno === anno && p.mese === m);
    return p?.pagato ?? 0;
  };

  const togglePagato = async (m: number) => {
    const dovuto = dovutoPerMese(m);
    const pagatoAttuale = pagatoPerMese(m);
    const nuovoPagato = pagatoAttuale > 0 ? 0 : dovuto;
    setSavingMese(m);
    try {
      await fetch(`/api/collaboratori/${collab.id}/pagamenti`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno, mese: m, dovuto, pagato: nuovoPagato }),
      });
      onChanged();
    } finally {
      setSavingMese(null);
    }
  };

  const updatePagato = async (m: number, importo: number) => {
    const dovuto = dovutoPerMese(m);
    setSavingMese(m);
    try {
      await fetch(`/api/collaboratori/${collab.id}/pagamenti`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno, mese: m, dovuto, pagato: importo }),
      });
      onChanged();
    } finally {
      setSavingMese(null);
    }
  };

  // Anticipi
  const [newAnticipo, setNewAnticipo] = useState({ mese: "", importo: "" });
  const addAnticipo = async () => {
    if (!newAnticipo.mese || !newAnticipo.importo) return;
    await fetch(`/api/collaboratori/${collab.id}/anticipi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mese: newAnticipo.mese,
        importo: parseFloat(newAnticipo.importo) || 0,
        restituito: false,
      }),
    });
    setNewAnticipo({ mese: "", importo: "" });
    onChanged();
  };
  const toggleRestituito = async (a: AnticipoColl) => {
    await fetch(`/api/collaboratori/${collab.id}/anticipi`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, restituito: !a.restituito }),
    });
    onChanged();
  };
  const delAnticipo = async (a: AnticipoColl) => {
    if (!confirm("Eliminare questo anticipo?")) return;
    await fetch(`/api/collaboratori/${collab.id}/anticipi`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id }),
    });
    onChanged();
  };

  return (
    <div className="space-y-5">
      {/* Pagamenti per mese */}
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Mese", "Dovuto", "Pagato", "Da pagare", ""].map((h) => (
                <th
                  key={h}
                  className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase ${
                    h === "Mese" ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="zebra">
            {MESI.map((meseNome, i) => {
              const m = i + 1;
              const dovuto = dovutoPerMese(m);
              const pagato = pagatoPerMese(m);
              const daPagare = round2(dovuto - pagato);
              const haAttivita = dovuto > 0 || pagato > 0;
              if (!haAttivita) return null;
              const fullyPaid = pagato >= dovuto && dovuto > 0;
              return (
                <tr key={m} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {meseNome}
                  </td>
                  <td className="px-3 py-2 text-sm text-right text-gray-700">
                    {fmt(dovuto)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={pagato}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        if (v !== pagato) updatePagato(m, v);
                      }}
                      className="w-24 text-right text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-300"
                      style={{ color: "#22c55e" }}
                      disabled={savingMese === m}
                    />
                  </td>
                  <td
                    className="px-3 py-2 text-sm font-bold text-right"
                    style={{
                      color: daPagare > 0 ? "#f59e0b" : "#9ca3af",
                    }}
                  >
                    {fmt(daPagare)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => togglePagato(m)}
                      disabled={savingMese === m}
                      className="text-xs font-medium px-3 py-1 rounded-lg disabled:opacity-50"
                      style={
                        fullyPaid
                          ? { background: "#dcfce7", color: "#166534" }
                          : { background: "#0ea5e9", color: "#fff" }
                      }
                    >
                      {fullyPaid ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Pagato
                        </span>
                      ) : (
                        "Segna pagato"
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!MESI.some((_, i) => {
              const m = i + 1;
              return dovutoPerMese(m) > 0 || pagatoPerMese(m) > 0;
            }) && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-gray-400 py-6 text-xs italic"
                >
                  Nessun pagamento per {anno}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Anticipi */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">
          Anticipi ({collab.anticipi.length})
        </h3>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Mese", "Importo", "Restituito", ""].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase ${
                      h === "Importo" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {collab.anticipi.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-gray-400 py-6 text-xs italic"
                  >
                    Nessun anticipo
                  </td>
                </tr>
              )}
              {collab.anticipi.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-gray-100"
                  style={a.restituito ? { opacity: 0.6 } : undefined}
                >
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {a.mese || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs font-bold text-right text-gray-900">
                    {fmt(a.importo)}
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.restituito}
                        onChange={() => toggleRestituito(a)}
                        className="w-4 h-4"
                        style={{ accentColor: "#22c55e" }}
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: a.restituito ? "#166534" : "#92400e",
                        }}
                      >
                        {a.restituito ? "Restituito" : "Da restituire"}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => delAnticipo(a)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Riga aggiunta */}
              <tr className="border-t border-gray-100 bg-sky-50/40">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={newAnticipo.mese}
                    onChange={(e) =>
                      setNewAnticipo((s) => ({ ...s, mese: e.target.value }))
                    }
                    placeholder="Es. Aprile 2026"
                    className="w-full text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={newAnticipo.importo}
                    onChange={(e) =>
                      setNewAnticipo((s) => ({
                        ...s,
                        importo: e.target.value,
                      }))
                    }
                    placeholder="60"
                    className="w-24 text-xs text-right px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                  />
                </td>
                <td colSpan={2} className="px-3 py-2 text-right">
                  <button
                    onClick={addAnticipo}
                    disabled={!newAnticipo.mese || !newAnticipo.importo}
                    className="glass-btn-primary inline-flex items-center gap-1 text-white text-xs px-3 py-1 rounded-lg disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" /> Aggiungi
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Profilo Tab (read-only anagrafica + tariffe) ──────────────────────

function ProfiloTab({ collab }: { collab: Collaboratore }) {
  return (
    <div className="space-y-4">
      <div className="bg-white/60 rounded-xl p-4 grid grid-cols-2 gap-y-2 gap-x-4">
        <Field label="DNI / NIE" value={collab.dni} />
        <Field label="Cellulare" value={collab.cellulare} />
        <Field label="Email" value={collab.email} />
        <Field label="IBAN" value={collab.iban} mono />
        {collab.note && (
          <div className="col-span-2">
            <Field label="Note" value={collab.note} />
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">
          Tariffe ({collab.tariffe.length})
        </h3>
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase text-left">
                  Tipo Attività
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase text-right">
                  €/ora
                </th>
              </tr>
            </thead>
            <tbody className="zebra">
              {collab.tariffe.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center text-gray-400 py-6 text-xs italic"
                  >
                    Nessuna tariffa configurata
                  </td>
                </tr>
              )}
              {collab.tariffe.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {t.tipoAttivita}
                  </td>
                  <td
                    className="px-3 py-2 text-xs font-bold text-right"
                    style={{ color: "#0ea5e9" }}
                  >
                    {fmt(t.tariffaOraria)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Per modificare le tariffe usa il bottone &ldquo;Modifica
          Collaboratore&rdquo;.
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className={`text-sm text-gray-800 ${mono ? "font-mono" : ""}`}>
        {value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}
