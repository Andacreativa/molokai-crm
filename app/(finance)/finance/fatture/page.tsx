"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Download, X, Check } from "lucide-react";
import { fmt, TIPO_IMPOSTA_OPTIONS } from "@/lib/constants";
import FiltriBar from "@/components/FiltriBar";
import { PageSizeSelect, PageNav } from "@/components/Pagination";
import { exportFatturaPDF } from "@/lib/export";

// ─── Types ─────────────────────────────────────────────────────────────

interface Cliente {
  id: number;
  nome: string;
  cognome: string | null;
  partitaIva: string | null;
  dni: string | null;
  tipoImposta: string;
  via: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  paese: string | null;
  email: string | null;
  telefono: string | null;
}

interface Riga {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
}

interface Fattura {
  id: number;
  numero: string | null;
  data: string | null;
  scadenza: string | null;
  clienteId: number | null;
  cliente: Cliente | null;
  righe: string;
  baseImponibile: number;
  iva: number;
  totale: number;
  pagato: boolean;
  metodoPagamento: string | null;
  mese: number;
  anno: number;
  note: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────

const METODI_PAGAMENTO = ["transferencia", "tarjeta", "bizum", "efectivo"];
const METODI_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  bizum: "Bizum",
  efectivo: "Efectivo",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const isoDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

const addDays = (isoYmd: string, days: number) => {
  if (!isoYmd) return "";
  const d = new Date(isoYmd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function FatturePage() {
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fattura | null>(null);

  const load = async () => {
    const [fRes, cRes] = await Promise.all([
      fetch(`/api/fatture?anno=${anno}`),
      fetch("/api/clienti"),
    ]);
    const fData = await fRes.json();
    const cData = await cRes.json();
    setFatture(Array.isArray(fData) ? fData : []);
    setClienti(Array.isArray(cData) ? cData : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const q = search.toLowerCase();
  const filtered = fatture.filter((f) => {
    if (statusFilter === "pagate" && !f.pagato) return false;
    if (statusFilter === "scadute" && f.pagato) return false;
    const nome = `${f.cliente?.nome ?? ""} ${f.cliente?.cognome ?? ""}`.toLowerCase();
    return (f.numero ?? "").toLowerCase().includes(q) || nome.includes(q);
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, anno, pageSize]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totaleFatturato = useMemo(
    () => filtered.reduce((s, f) => s + f.totale, 0),
    [filtered],
  );
  const incassato = useMemo(
    () => filtered.filter((f) => f.pagato).reduce((s, f) => s + f.totale, 0),
    [filtered],
  );
  const daIncassare = totaleFatturato - incassato;

  const del = async (id: number) => {
    if (!confirm("Eliminare questa fattura?")) return;
    await fetch(`/api/fatture/${id}`, { method: "DELETE" });
    load();
  };

  const togglePagato = async (f: Fattura) => {
    await fetch(`/api/fatture/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagato: !f.pagato }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fatture</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} fatture · anno {anno}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <FiltriBar anno={anno} onAnno={setAnno} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            <option value="">Tutte</option>
            <option value="pagate">Pagate</option>
            <option value="scadute">Non pagate</option>
          </select>
          <PageSizeSelect pageSize={pageSize} onChange={setPageSize} />
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Nuova Fattura
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per numero o cliente..."
        className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Fatturato {anno}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totaleFatturato)}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Incassato
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#22c55e" }}>
            {fmt(incassato)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Da incassare
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#f59e0b" }}>
            {fmt(daIncassare)}
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Numero",
                  "Data",
                  "Cliente",
                  "Base",
                  "IVA",
                  "Totale",
                  "Scadenza",
                  "Stato",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${["Base", "IVA", "Totale"].includes(h) ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-12 text-sm">
                    Nessuna fattura trovata
                  </td>
                </tr>
              )}
              {paged.map((f) => {
                const nome = f.cliente
                  ? `${f.cliente.nome}${f.cliente.cognome ? " " + f.cliente.cognome : ""}`
                  : "—";
                return (
                  <tr
                    key={f.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {f.numero ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {f.data ? new Date(f.data).toLocaleDateString("it-IT") : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{nome}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {fmt(f.baseImponibile)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 text-right">{f.iva}%</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {fmt(f.totale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {f.scadenza ? new Date(f.scadenza).toLocaleDateString("it-IT") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePagato(f)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors"
                        style={
                          f.pagato
                            ? { background: "#dcfce7", color: "#166534" }
                            : { background: "#fef3c7", color: "#92400e" }
                        }
                      >
                        {f.pagato ? (
                          <>
                            <Check className="w-3 h-3" /> Pagata
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" /> Non pagata
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => exportFatturaPDF(f, f.cliente)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Scarica PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(f);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => del(f.id)}
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

      {filtered.length > 0 && (
        <PageNav
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          labelSuffix="fatture"
        />
      )}

      {showForm && (
        <FatturaFormModal
          editing={editing}
          clienti={clienti}
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

// ─── Form Modal ────────────────────────────────────────────────────────

function FatturaFormModal({
  editing,
  clienti,
  onClose,
  onSaved,
}: {
  editing: Fattura | null;
  clienti: Cliente[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clienteId, setClienteId] = useState<string>(
    editing?.clienteId ? String(editing.clienteId) : "",
  );
  const [data, setData] = useState<string>(
    editing?.data ? isoDate(editing.data) : isoDate(new Date()),
  );
  const [scadenza, setScadenza] = useState<string>(
    editing?.scadenza
      ? isoDate(editing.scadenza)
      : addDays(isoDate(new Date()), 30),
  );
  const clienteSelezionato = clienti.find(
    (c) => c.id === parseInt(clienteId || "0"),
  );
  const [iva, setIva] = useState<string>(
    editing
      ? String(editing.iva)
      : clienteSelezionato?.tipoImposta === "IVA Exenta"
        ? "0"
        : "21",
  );
  const [righe, setRighe] = useState<Riga[]>(() => {
    if (editing) {
      try {
        const parsed = JSON.parse(editing.righe);
        return Array.isArray(parsed) && parsed.length > 0
          ? parsed
          : [{ descrizione: "", quantita: 1, prezzoUnitario: 0 }];
      } catch {
        return [{ descrizione: "", quantita: 1, prezzoUnitario: 0 }];
      }
    }
    return [{ descrizione: "", quantita: 1, prezzoUnitario: 0 }];
  });
  const [pagato, setPagato] = useState<boolean>(editing?.pagato ?? false);
  const [metodoPagamento, setMetodoPagamento] = useState<string>(
    editing?.metodoPagamento ?? "transferencia",
  );
  const [note, setNote] = useState<string>(editing?.note ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) return;
    if (!clienteSelezionato) return;
    setIva(clienteSelezionato.tipoImposta === "IVA Exenta" ? "0" : "21");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  useEffect(() => {
    if (editing) return;
    if (data) setScadenza(addDays(data, 30));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const baseImponibile = round2(
    righe.reduce(
      (s, r) => s + (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0),
      0,
    ),
  );
  const ivaNum = Number(iva) || 0;
  const ivaImporto = round2(baseImponibile * (ivaNum / 100));
  const totale = round2(baseImponibile + ivaImporto);

  const updateRiga = (i: number, patch: Partial<Riga>) => {
    setRighe((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRiga = () =>
    setRighe((prev) => [
      ...prev,
      { descrizione: "", quantita: 1, prezzoUnitario: 0 },
    ]);
  const delRiga = (i: number) =>
    setRighe((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
    );

  const save = async () => {
    if (!clienteId) {
      alert("Seleziona un cliente");
      return;
    }
    if (righe.every((r) => !r.descrizione.trim())) {
      alert("Aggiungi almeno una riga con descrizione");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clienteId: parseInt(clienteId),
        data,
        scadenza,
        righe,
        iva: ivaNum,
        pagato,
        metodoPagamento,
        note,
      };
      if (editing) {
        await fetch(`/api/fatture/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/fatture", {
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
            {editing ? `Modifica ${editing.numero ?? "Fattura"}` : "Nuova Fattura"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Cliente *
            </label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">Seleziona cliente...</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.cognome ? " " + c.cognome : ""}
                  {c.partitaIva
                    ? ` — ${c.partitaIva}`
                    : c.dni
                      ? ` — ${c.dni}`
                      : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Data
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Scadenza
            </label>
            <input
              type="date"
              value={scadenza}
              onChange={(e) => setScadenza(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              IVA
            </label>
            <div className="flex gap-2">
              {TIPO_IMPOSTA_OPTIONS.map((opt) => {
                const val = opt === "IVA Exenta" ? "0" : "21";
                const active = iva === val;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIva(val)}
                    className="flex-1 text-xs py-2 px-2 rounded-lg border font-semibold transition-all"
                    style={
                      active
                        ? {
                            background: "#e0f2fe",
                            color: "#0369a1",
                            borderColor: "#7dd3fc",
                          }
                        : {
                            background: "#fff",
                            color: "#94a3b8",
                            borderColor: "#e2e8f0",
                          }
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Righe
            </label>
            <button
              type="button"
              onClick={addRiga}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Aggiungi riga
            </button>
          </div>
          <div className="space-y-2">
            {righe.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_100px_90px_32px] gap-2 items-start"
              >
                <input
                  type="text"
                  value={r.descrizione}
                  onChange={(e) => updateRiga(i, { descrizione: e.target.value })}
                  placeholder="Descrizione"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <input
                  type="number"
                  step="0.01"
                  value={r.quantita}
                  onChange={(e) =>
                    updateRiga(i, { quantita: parseFloat(e.target.value) || 0 })
                  }
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <input
                  type="number"
                  step="0.01"
                  value={r.prezzoUnitario}
                  onChange={(e) =>
                    updateRiga(i, {
                      prezzoUnitario: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <div className="px-2 py-2 text-sm text-right font-semibold text-gray-800 bg-gray-50 rounded-lg">
                  {fmt(
                    (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => delRiga(i)}
                  disabled={righe.length === 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Base imponibile
            </p>
            <p className="text-sm font-bold text-gray-900">{fmt(baseImponibile)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              IVA ({ivaNum}%)
            </p>
            <p className="text-sm font-bold text-gray-900">{fmt(ivaImporto)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Totale
            </p>
            <p className="text-sm font-bold" style={{ color: "#0ea5e9" }}>
              {fmt(totale)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Metodo pagamento
            </label>
            <select
              value={metodoPagamento}
              onChange={(e) => setMetodoPagamento(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {METODI_PAGAMENTO.map((m) => (
                <option key={m} value={m}>
                  {METODI_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pagato}
                onChange={(e) => setPagato(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: "#0ea5e9" }}
              />
              <span className="text-sm text-gray-700 font-medium">Pagata</span>
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
          />
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
            disabled={saving}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Crea Fattura"}
          </button>
        </div>
      </div>
    </div>
  );
}
