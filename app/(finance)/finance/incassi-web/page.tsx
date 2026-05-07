"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { fmt, MESI, ANNI } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

// FareHarbor per-data (modello IncassoFareHarbor)
interface FHDayRow {
  id: number;
  data: string; // ISO
  mese: number;
  anno: number;
  netto: number;
  fee: number;
  lordo: number;
  note: string | null;
}

interface StripeRow {
  id?: number;
  anno: number;
  mese: number;
  lordo: number;
  commissioni: number;
  rimborsi: number;
  netto: number;
}

interface GYGRow {
  id?: number;
  anno: number;
  mese: number;
  lordo: number;
  commissioni: number;
  netto: number;
}

type Tab = "fareharbor" | "stripe" | "gyg";

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Page ──────────────────────────────────────────────────────────────

export default function IncassiWebPage() {
  const [tab, setTab] = useState<Tab>("fareharbor");
  const [anno, setAnno] = useState(new Date().getFullYear());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incassi Web</h1>
          <p className="text-gray-500 text-sm mt-1">
            FareHarbor, Stripe, Get Your Guide · anno {anno}
          </p>
        </div>
        <select
          value={anno}
          onChange={(e) => setAnno(parseInt(e.target.value))}
          className="text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 outline-none cursor-pointer"
        >
          {ANNI.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            ["fareharbor", "FareHarbor"],
            ["stripe", "Stripe"],
            ["gyg", "Get Your Guide"],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px"
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

      {tab === "fareharbor" && <FareHarborTab anno={anno} />}
      {tab === "stripe" && <StripeTab anno={anno} />}
      {tab === "gyg" && <GYGTab anno={anno} />}
    </div>
  );
}

// ─── Riepilogo mensile per tab attivo ──────────────────────────────────

// ─── Box riepilogo mensile cliccabile (condiviso FH/Stripe/GYG) ────────

function MonthlyClickBox({
  title,
  totaliMensili,
  meseFiltro,
  onMeseChange,
  anno,
}: {
  title: string;
  totaliMensili: number[];
  meseFiltro: number | null;
  onMeseChange: (m: number | null) => void;
  anno: number;
}) {
  const totaleAnno = totaliMensili.reduce((a, b) => a + b, 0);
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {meseFiltro !== null && (
          <button
            onClick={() => onMeseChange(null)}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium"
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
              onClick={() => onMeseChange(isActive ? null : m)}
              className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg border transition-all cursor-pointer hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
              style={cellStyle}
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
                {hasValue ? fmt(tot).replace(" €", "") : "—"}
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
  );
}

// ─── FareHarbor Tab ────────────────────────────────────────────────────

function FareHarborTab({
  anno,
  onSaved,
}: {
  anno: number;
  onSaved?: () => void;
}) {
  const [rows, setRows] = useState<FHDayRow[]>([]);
  // mese === null → tutti i mesi
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/incassi-fh-day?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const rowsMese = useMemo(
    () =>
      meseFiltro === null ? rows : rows.filter((r) => r.mese === meseFiltro),
    [rows, meseFiltro],
  );

  // Totale anno = somma dei NETTO (valore che entra in banca, e in bilancio)
  const totaleAnno = useMemo(
    () => rows.reduce((s, r) => s + r.netto, 0),
    [rows],
  );
  // Totale fee anno = somma processing fees
  const totaleFee = useMemo(() => rows.reduce((s, r) => s + r.fee, 0), [rows]);

  // Riepilogo mensile per il box 12-celle (somma del netto)
  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const r of rows) arr[r.mese - 1] += r.netto;
    return arr;
  }, [rows]);

  // Aggregati per mese (lordo/fee/netto) per la vista summary di default.
  const aggregatiPerMese = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      mese: i + 1,
      lordo: 0,
      fee: 0,
      netto: 0,
    }));
    for (const r of rows) {
      const idx = r.mese - 1;
      if (idx < 0 || idx > 11) continue;
      arr[idx].lordo += r.lordo;
      arr[idx].fee += r.fee;
      arr[idx].netto += r.netto;
    }
    return arr;
  }, [rows]);

  const isoDate = (d: string) => new Date(d).toISOString().slice(0, 10);

  const updateLocal = (id: number, patch: Partial<FHDayRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const saveField = async (
    id: number,
    field: "data" | "netto" | "fee" | "lordo" | "note",
    value: string,
  ) => {
    try {
      const res = await fetch(`/api/incassi-fh-day/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Errore salvataggio");
        load();
        return;
      }
      const updated: FHDayRow = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      onSaved?.();
    } catch (e) {
      alert(String(e));
      load();
    }
  };

  const del = async (id: number) => {
    if (!confirm("Eliminare questa riga?")) return;
    await fetch(`/api/incassi-fh-day/${id}`, { method: "DELETE" });
    load();
    onSaved?.();
  };

  const addRow = async () => {
    // Default: oggi se nell'anno corrente, altrimenti 1° gennaio dell'anno selezionato
    const today = new Date();
    const baseDate =
      today.getFullYear() === anno ? today : new Date(anno, 0, 1);
    const data = baseDate.toISOString();
    const res = await fetch("/api/incassi-fh-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, netto: 0, fee: 0, lordo: 0 }),
    });
    if (res.ok) {
      load();
      onSaved?.();
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar bottoni: a sinistra back button (in vista dettaglio mese)
          + count, a destra azioni Aggiungi/Importa. */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {meseFiltro !== null && (
            <button
              onClick={() => setMeseFiltro(null)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900"
            >
              <ArrowLeft className="w-4 h-4" /> Tutti i mesi
            </button>
          )}
          <span className="text-xs text-gray-500">
            {meseFiltro === null
              ? `${rows.length} righe · tutti i mesi`
              : `${rowsMese.length} righe · ${MESI[meseFiltro - 1]} ${anno}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" style={{ color: "#0ea5e9" }} /> Aggiungi
            riga
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Upload className="w-4 h-4" /> Importa CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={`Totale FareHarbor ${anno}`} value={totaleAnno} />
        <StatCard
          label={`Totale Fee ${anno}`}
          value={totaleFee}
          color="#ef4444"
        />
        <RefundReserveCard anno={anno} />
      </div>

      <MonthlyClickBox
        title="Riepilogo FareHarbor mensile (netto)"
        totaliMensili={totaliMensili}
        meseFiltro={meseFiltro}
        onMeseChange={setMeseFiltro}
        anno={anno}
      />

      {/* Vista summary mensile (default — quando nessun mese è selezionato).
          Click su una riga → drill-down sulla vista per-data del mese. */}
      {meseFiltro === null && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Mese", "Lordo", "Fee", "Netto"].map((h, i) => (
                    <th
                      key={h}
                      className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="zebra">
                {aggregatiPerMese.map((agg) => {
                  const hasValue = agg.lordo !== 0 || agg.fee !== 0 || agg.netto !== 0;
                  return (
                    <tr
                      key={agg.mese}
                      onClick={() => setMeseFiltro(agg.mese)}
                      className="border-b border-gray-50 hover:bg-sky-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {MESI[agg.mese - 1]}
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-semibold text-right"
                        style={{ color: hasValue ? "#1e293b" : "#cbd5e1" }}
                      >
                        {fmt(agg.lordo)}
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-semibold text-right"
                        style={{ color: hasValue ? "#ef4444" : "#cbd5e1" }}
                      >
                        {fmt(agg.fee)}
                      </td>
                      <td
                        className="px-4 py-3 text-sm font-bold text-right"
                        style={{ color: hasValue ? "#0ea5e9" : "#cbd5e1" }}
                      >
                        {fmt(agg.netto)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista dettaglio per-data — solo quando un mese è selezionato. */}
      {meseFiltro !== null && (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Data", "Netto", "Fee", "Lordo", ""].map((h, i) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${i === 0 || i === 4 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {rowsMese.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nessun incasso per{" "}
                    {`${MESI[meseFiltro - 1]} ${anno}`}
                  </td>
                </tr>
              )}
              {rowsMese.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-2 py-1.5 w-[180px]">
                    <input
                      type="date"
                      value={isoDate(r.data)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const d = new Date(v);
                        updateLocal(r.id, {
                          data: d.toISOString(),
                          mese: d.getMonth() + 1,
                          anno: d.getFullYear(),
                        });
                      }}
                      onFocus={(e) => {
                        e.currentTarget.dataset.initial = e.currentTarget.value;
                      }}
                      onBlur={(e) => {
                        const initial = e.currentTarget.dataset.initial;
                        if (
                          e.currentTarget.value &&
                          e.currentTarget.value !== initial
                        ) {
                          saveField(r.id, "data", e.currentTarget.value);
                        }
                      }}
                      className="w-full text-sm px-2 py-1.5 rounded-md border border-transparent hover:border-gray-200 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white bg-transparent"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right w-[140px]">
                    <EuroInput
                      value={r.netto}
                      onSave={(v) => {
                        updateLocal(r.id, { netto: v });
                        saveField(r.id, "netto", String(v));
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right w-[120px]">
                    <EuroInput
                      value={r.fee}
                      onSave={(v) => {
                        updateLocal(r.id, { fee: v });
                        saveField(r.id, "fee", String(v));
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right w-[140px]">
                    <EuroInput
                      value={r.lordo}
                      onSave={(v) => {
                        updateLocal(r.id, { lordo: v });
                        saveField(r.id, "lordo", String(v));
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => del(r.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showImport && (
        <FareHarborCsvImportModal
          anno={anno}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}

// CSV import modal specifico per FareHarbor per-data: il CSV BBVA ha
// payout_date / net_payout_amount / payout_status. Crea una riga per
// ogni payout Succeeded dell'anno selezionato.
function FareHarborCsvImportModal({
  anno,
  onClose,
  onImported,
}: {
  anno: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const isCSV = /\.csv$/i.test(file.name);
      const wb = isCSV
        ? XLSX.read(await file.text(), { type: "string", cellDates: true })
        : XLSX.read(await file.arrayBuffer(), {
            type: "array",
            cellDates: true,
          });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        setResult({ ok: 0, errors: ["File vuoto"] });
        return;
      }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        raw: false,
        dateNF: "yyyy-mm-dd",
      });
      const righe: Array<{
        data: string;
        netto: number;
        fee: number;
        lordo: number;
      }> = [];
      const errors: string[] = [];
      let skippedNotSucceeded = 0;
      let skippedOtherYear = 0;
      let skippedBadDate = 0;
      raw.forEach((row, i) => {
        const status = String(getCell(row, "payout_status") ?? "")
          .trim()
          .toLowerCase();
        if (status !== "succeeded") {
          skippedNotSucceeded++;
          return;
        }
        const rawDate = getCell(row, "payout_date");
        const d =
          rawDate instanceof Date
            ? rawDate
            : new Date(String(rawDate ?? "").trim());
        if (isNaN(d.getTime())) {
          skippedBadDate++;
          errors.push(`Riga ${i + 2}: payout_date non valida`);
          return;
        }
        if (d.getFullYear() !== anno) {
          skippedOtherYear++;
          return;
        }
        const netto = toNumber(getCell(row, "net_payout_amount"));
        const fee = Math.abs(toNumber(getCell(row, "processing_fee_amount")));
        const lordo = toNumber(getCell(row, "gross_amount"));
        righe.push({ data: d.toISOString(), netto, fee, lordo });
      });

      const res = await fetch("/api/incassi-fh-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ righe }),
      });
      const json = await res.json();
      if (skippedNotSucceeded > 0)
        errors.push(`${skippedNotSucceeded} payout non-Succeeded saltati`);
      if (skippedOtherYear > 0)
        errors.push(`${skippedOtherYear} payout di altri anni saltati`);
      if (skippedBadDate > 0)
        errors.push(`${skippedBadDate} righe senza payout_date valida`);
      setResult({ ok: json.ok ?? 0, errors });
      if (json.ok > 0) onImported();
    } catch (e) {
      setResult({ ok: 0, errors: [String(e)] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Importa CSV</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl p-8 border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{
            borderColor: dragActive ? "#0ea5e9" : "#cbd5e1",
            background: dragActive ? "#f0f9ff" : "#f8fafc",
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#e0f2fe" }}
          >
            <Upload className="w-7 h-7" style={{ color: "#0ea5e9" }} />
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {uploading
              ? "Caricamento in corso..."
              : "Trascina qui il file CSV o clicca per selezionarlo"}
          </p>
          <p className="text-xs text-gray-500 text-center">
            Colonne attese:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
              payout_date · net_payout_amount · processing_fee_amount ·
              gross_amount · payout_status
            </code>
            <br />
            Anno {anno} · solo righe Succeeded · upsert per data
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {result && (
          <div
            className="rounded-xl p-3 flex items-start gap-3"
            style={{
              background: result.ok > 0 ? "#dcfce7" : "#fee2e2",
              color: result.ok > 0 ? "#166534" : "#991b1b",
            }}
          >
            {result.ok > 0 ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {result.ok} righe importate
                {result.errors.length > 0
                  ? ` · ${result.errors.length} errori`
                  : ""}
              </p>
              {result.errors.length > 0 && (
                <ul className="text-xs mt-1 space-y-0.5 opacity-80">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stripe Tab ────────────────────────────────────────────────────────

function StripeTab({ anno, onSaved }: { anno: number; onSaved?: () => void }) {
  const [rows, setRows] = useState<StripeRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch(`/api/incassi-web/stripe?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const rowFor = (mese: number): StripeRow =>
    rows.find((r) => r.mese === mese) ?? {
      anno,
      mese,
      lordo: 0,
      commissioni: 0,
      rimborsi: 0,
      netto: 0,
    };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        lordo: acc.lordo + r.lordo,
        commissioni: acc.commissioni + r.commissioni,
        rimborsi: acc.rimborsi + r.rimborsi,
        netto: acc.netto + r.netto,
      }),
      { lordo: 0, commissioni: 0, rimborsi: 0, netto: 0 },
    );
  }, [rows]);

  // Totali mensili NETTI per il box riepilogo
  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const r of rows) arr[r.mese - 1] += r.netto;
    return arr;
  }, [rows]);

  // Mesi visibili nella tabella: tutti, oppure solo il mese filtrato
  const mesiVisibili =
    meseFiltro === null
      ? MESI.map((_, i) => i + 1)
      : [meseFiltro];

  const save = async (
    mese: number,
    patch: Partial<Pick<StripeRow, "lordo" | "commissioni" | "rimborsi">>,
  ) => {
    setSaving(mese);
    const current = rowFor(mese);
    const next = { ...current, ...patch };
    try {
      const res = await fetch("/api/incassi-web/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anno,
          mese,
          lordo: next.lordo,
          commissioni: next.commissioni,
          rimborsi: next.rimborsi,
        }),
      });
      const saved: StripeRow = await res.json();
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.mese === mese);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        return [...prev, saved].sort((a, b) => a.mese - b.mese);
      });
      onSaved?.();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExcelUploadModalButton
          anno={anno}
          endpoint="stripe"
          title="Importa Stripe da CSV (export per-transaction)"
          formatHint="Colonne: Type · Created · Amount · Fees · Net. Solo righe Type=Charge. Importi in formato IT (30,00)."
          buildBatch={(rows, y) => {
            const payloads: Record<string, unknown>[] = [];
            const errors: string[] = [];
            const byMonth = new Map<
              number,
              { lordo: number; commissioni: number; netto: number }
            >();
            let skippedNonCharge = 0;
            let skippedOtherYear = 0;
            let skippedBadDate = 0;
            rows.forEach((row, i) => {
              const type = String(getCell(row, "Type") ?? "")
                .trim()
                .toLowerCase();
              if (type !== "charge") {
                skippedNonCharge++;
                return;
              }
              const rawDate = getCell(row, "Created");
              const created =
                rawDate instanceof Date
                  ? rawDate
                  : new Date(String(rawDate ?? "").trim());
              if (isNaN(created.getTime())) {
                skippedBadDate++;
                errors.push(`Riga ${i + 2}: Created non valida`);
                return;
              }
              if (created.getFullYear() !== y) {
                skippedOtherYear++;
                return;
              }
              const mese = created.getMonth() + 1;
              const amount = toNumber(getCell(row, "Amount"));
              const fees = toNumber(getCell(row, "Fees"));
              const net = toNumber(getCell(row, "Net"));
              const cur = byMonth.get(mese) ?? {
                lordo: 0,
                commissioni: 0,
                netto: 0,
              };
              cur.lordo += amount;
              cur.commissioni += fees;
              cur.netto += net;
              byMonth.set(mese, cur);
            });
            for (const [mese, agg] of byMonth) {
              payloads.push({
                anno: y,
                mese,
                lordo: Math.round(agg.lordo * 100) / 100,
                commissioni: Math.round(agg.commissioni * 100) / 100,
                rimborsi: 0,
                netto: Math.round(agg.netto * 100) / 100,
              });
            }
            if (skippedNonCharge > 0)
              errors.push(`${skippedNonCharge} righe non-Charge saltate`);
            if (skippedOtherYear > 0)
              errors.push(
                `${skippedOtherYear} transazioni di altri anni saltate`,
              );
            if (skippedBadDate > 0)
              errors.push(`${skippedBadDate} righe senza Created valida`);
            return { payloads, errors };
          }}
          onImported={() => {
            load();
            onSaved?.();
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label={`Lordo ${anno}`} value={totals.lordo} />
        <StatCard
          label="Commissioni"
          value={totals.commissioni}
          color="#64748b"
        />
        <StatCard label="Rimborsi" value={totals.rimborsi} color="#ef4444" />
        <StatCard label="Netto" value={totals.netto} color="#0ea5e9" />
      </div>

      <MonthlyClickBox
        title="Riepilogo Stripe mensile (netto)"
        totaliMensili={totaliMensili}
        meseFiltro={meseFiltro}
        onMeseChange={setMeseFiltro}
        anno={anno}
      />

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Mese", "Lordo", "Commissioni", "Rimborsi", "Netto"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${i === 0 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="zebra">
              {mesiVisibili.map((m) => {
                const mese = MESI[m - 1];
                const r = rowFor(m);
                const loading = saving === m;
                return (
                  <tr
                    key={m}
                    className="border-b border-gray-50"
                    style={loading ? { opacity: 0.6 } : undefined}
                  >
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {mese}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <EuroInput
                        value={r.lordo}
                        onSave={(v) => save(m, { lordo: v })}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <EuroInput
                        value={r.commissioni}
                        onSave={(v) => save(m, { commissioni: v })}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <EuroInput
                        value={r.rimborsi}
                        onSave={(v) => save(m, { rimborsi: v })}
                      />
                    </td>
                    <td
                      className="px-4 py-2 text-sm font-bold text-right"
                      style={{ color: "#0ea5e9" }}
                    >
                      {fmt(r.netto)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── GYG Tab ───────────────────────────────────────────────────────────

function GYGTab({ anno, onSaved }: { anno: number; onSaved?: () => void }) {
  const [rows, setRows] = useState<GYGRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch(`/api/incassi-web/gyg?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const rowFor = (mese: number): GYGRow =>
    rows.find((r) => r.mese === mese) ?? {
      anno,
      mese,
      lordo: 0,
      commissioni: 0,
      netto: 0,
    };

  const totaliMensili = useMemo(() => {
    const arr = Array(12).fill(0) as number[];
    for (const r of rows) arr[r.mese - 1] += r.netto;
    return arr;
  }, [rows]);
  const mesiVisibili =
    meseFiltro === null ? MESI.map((_, i) => i + 1) : [meseFiltro];

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          lordo: acc.lordo + r.lordo,
          commissioni: acc.commissioni + r.commissioni,
          netto: acc.netto + r.netto,
        }),
        { lordo: 0, commissioni: 0, netto: 0 },
      ),
    [rows],
  );

  const save = async (mese: number, lordo: number) => {
    setSaving(mese);
    try {
      const res = await fetch("/api/incassi-web/gyg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno, mese, lordo }),
      });
      const saved: GYGRow = await res.json();
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.mese === mese);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        return [...prev, saved].sort((a, b) => a.mese - b.mese);
      });
      onSaved?.();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExcelUploadModalButton
          anno={anno}
          endpoint="gyg"
          title="Importa Get Your Guide da Excel (export per-booking)"
          formatHint="Colonne: Booking Ref # · Status · Activity Date · Retail Price · Commission Amount · Retail Price Minus Commission. Le prenotazioni Reversal/Reversed vengono ignorate."
          buildBatch={(rows, y) => {
            const payloads: Record<string, unknown>[] = [];
            const errors: string[] = [];
            const byMonth = new Map<
              number,
              { lordo: number; commissioni: number; netto: number }
            >();
            let skippedReversal = 0;
            let skippedOtherYear = 0;
            let skippedNoDate = 0;
            rows.forEach((row, i) => {
              const status = String(getCell(row, "Status") ?? "")
                .trim()
                .toLowerCase();
              if (status === "reversal" || status === "reversed") {
                skippedReversal++;
                return;
              }
              const rawDate = getCell(row, "Activity Date");
              const activityDate =
                rawDate instanceof Date
                  ? rawDate
                  : new Date(String(rawDate ?? "").trim());
              if (isNaN(activityDate.getTime())) {
                skippedNoDate++;
                errors.push(`Riga ${i + 2}: Activity Date non valida`);
                return;
              }
              if (activityDate.getFullYear() !== y) {
                skippedOtherYear++;
                return;
              }
              const mese = activityDate.getMonth() + 1;
              const retailPrice = toNumber(getCell(row, "Retail Price"));
              const commission = Math.abs(
                toNumber(getCell(row, "Commission Amount")),
              );
              const netto = toNumber(
                getCell(row, "Retail Price Minus Commission"),
              );
              const cur = byMonth.get(mese) ?? {
                lordo: 0,
                commissioni: 0,
                netto: 0,
              };
              cur.lordo += retailPrice;
              cur.commissioni += commission;
              cur.netto += netto;
              byMonth.set(mese, cur);
            });
            for (const [mese, agg] of byMonth) {
              payloads.push({
                anno: y,
                mese,
                lordo: Math.round(agg.lordo * 100) / 100,
                commissioni: Math.round(agg.commissioni * 100) / 100,
                netto: Math.round(agg.netto * 100) / 100,
              });
            }
            if (skippedReversal > 0)
              errors.push(
                `${skippedReversal} prenotazioni Reversal/Reversed saltate`,
              );
            if (skippedOtherYear > 0)
              errors.push(
                `${skippedOtherYear} prenotazioni di altri anni saltate`,
              );
            if (skippedNoDate > 0)
              errors.push(`${skippedNoDate} righe senza Activity Date valida`);
            return { payloads, errors };
          }}
          onImported={() => {
            load();
            onSaved?.();
          }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={`Lordo ${anno}`} value={totals.lordo} />
        <StatCard
          label="Commissioni (25%)"
          value={totals.commissioni}
          color="#64748b"
        />
        <StatCard label="Netto" value={totals.netto} color="#0ea5e9" />
      </div>

      <MonthlyClickBox
        title="Riepilogo Get Your Guide mensile (netto)"
        totaliMensili={totaliMensili}
        meseFiltro={meseFiltro}
        onMeseChange={setMeseFiltro}
        anno={anno}
      />

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Mese", "Lordo", "Commissioni (25%)", "Netto"].map((h, i) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${i === 0 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {mesiVisibili.map((m) => {
                const mese = MESI[m - 1];
                const r = rowFor(m);
                const loading = saving === m;
                return (
                  <tr
                    key={m}
                    className="border-b border-gray-50"
                    style={loading ? { opacity: 0.6 } : undefined}
                  >
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {mese}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <EuroInput value={r.lordo} onSave={(v) => save(m, v)} />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 text-right">
                      {fmt(r.commissioni)}
                    </td>
                    <td
                      className="px-4 py-2 text-sm font-bold text-right"
                      style={{ color: "#0ea5e9" }}
                    >
                      {fmt(r.netto)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────

// Input monetario: formattato "700,00 €" quando non focused, raw "700.00"
// quando editabile. Parser tollerante accetta formato IT (virgola decimale)
// e EN (punto decimale).
function EuroInput({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>(value.toFixed(2));

  const parseMoney = (s: string): number => {
    const trimmed = s.trim();
    if (!trimmed) return 0;
    // Formato IT con virgola: "1.234,50" → "1234.50"
    if (trimmed.includes(",")) {
      return parseFloat(trimmed.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(trimmed) || 0;
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? editValue : fmt(value)}
      onFocus={(e) => {
        setEditing(true);
        setEditValue(value.toFixed(2));
        setTimeout(() => e.target.select(), 0);
      }}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = round2(parseMoney(editValue));
        if (n !== value) onSave(n);
      }}
      className="w-28 text-right text-sm px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
    />
  );
}

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

// Card con valore editabile inline, persistente in DB.
// Stesso layout di StatCard, ma il value è un input che passa da
// formattato (€12,34) a editabile al focus.
function RefundReserveCard({ anno }: { anno: number }) {
  const [value, setValue] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("0.00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(
        `/api/incassi-web/fareharbor/reserve?anno=${anno}`,
      );
      const data = await res.json();
      setValue(Number(data?.refundReserve) || 0);
    })();
  }, [anno]);

  const parseMoney = (s: string): number => {
    const t = s.trim();
    if (!t) return 0;
    if (t.includes(",")) {
      return parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(t) || 0;
  };

  const save = async (v: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/incassi-web/fareharbor/reserve", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno, refundReserve: v }),
      });
      const data = await res.json();
      setValue(Number(data?.refundReserve) || 0);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        Refund Reserve
      </p>
      <input
        type="text"
        inputMode="decimal"
        value={editing ? editValue : fmt(value)}
        onFocus={(e) => {
          setEditing(true);
          setEditValue(value.toFixed(2));
          setTimeout(() => e.target.select(), 0);
        }}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = Math.round(parseMoney(editValue) * 100) / 100;
          if (n !== value) save(n);
        }}
        disabled={saving}
        className="text-2xl font-bold mt-1 w-full bg-transparent outline-none rounded px-1 -mx-1 focus:bg-white focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
        style={{ color: "#f59e0b" }}
      />
    </div>
  );
}

// ─── Excel upload helpers ──────────────────────────────────────────────

// Parsing mese tollerante: accetta nome italiano completo/abbreviato,
// numero 1-12, stringa numerica.
function parseMese(v: unknown): number | null {
  if (typeof v === "number") {
    if (v >= 1 && v <= 12) return Math.floor(v);
    return null;
  }
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  const idx = MESI.findIndex((m) => m.toLowerCase().startsWith(s.slice(0, 3)));
  return idx >= 0 ? idx + 1 : null;
}

// Lookup case/whitespace-insensitive di una cella per nome colonna.
function getCell(row: Record<string, unknown>, ...keys: string[]): unknown {
  const normalized: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    normalized[k.toLowerCase().replace(/\s+/g, " ").trim()] = row[k];
  }
  for (const k of keys) {
    const key = k.toLowerCase().replace(/\s+/g, " ").trim();
    if (key in normalized) return normalized[key];
  }
  return undefined;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  // Normalizza formato europeo con virgola
  if (s.includes(",") && !s.match(/,\d{3}(,|$)/)) {
    return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return parseFloat(s) || 0;
}

// Box drag & drop per import xlsx. `buildBatch` trasforma l'intero foglio
// in N payload (può essere 1:1, M:1 con aggregazione, o filtering). POST upsert
// sull'endpoint per ogni payload.
function ExcelUploadBox({
  anno,
  endpoint,
  title,
  formatHint,
  buildBatch,
  onImported,
}: {
  anno: number;
  endpoint: "fareharbor" | "stripe" | "gyg";
  title: string;
  formatHint: string;
  buildBatch: (
    rows: Record<string, unknown>[],
    anno: number,
  ) => { payloads: Record<string, unknown>[]; errors: string[] };
  onImported: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const isCSV = /\.csv$/i.test(file.name);
      // CSV → leggi come testo (UTF-8), xlsx binary → ArrayBuffer.
      // xlsx library gestisce entrambi i formati con il tipo giusto.
      const wb = isCSV
        ? XLSX.read(await file.text(), { type: "string", cellDates: true })
        : XLSX.read(await file.arrayBuffer(), {
            type: "array",
            cellDates: true,
          });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        setResult({ ok: 0, errors: ["File vuoto o non valido"] });
        return;
      }
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        raw: false,
        dateNF: "yyyy-mm-dd",
      });

      const { payloads, errors } = buildBatch(rawRows, anno);

      const responses = await Promise.allSettled(
        payloads.map((p) =>
          fetch(`/api/incassi-web/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          }).then(async (r) => {
            if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
            return true;
          }),
        ),
      );
      const okCount = responses.filter((r) => r.status === "fulfilled").length;
      const failed = responses.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        errors.push(
          `${failed.length} richieste fallite: ${failed
            .slice(0, 3)
            .map((r) => (r.status === "rejected" ? String(r.reason) : ""))
            .join("; ")}`,
        );
      }
      setResult({ ok: okCount, errors });
      if (okCount > 0) onImported();
    } catch (e) {
      setResult({ ok: 0, errors: [String(e)] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className="glass-card rounded-2xl p-6 border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
        style={{
          borderColor: dragActive ? "#0ea5e9" : "#cbd5e1",
          background: dragActive ? "#f0f9ff" : undefined,
        }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#e0f2fe" }}
        >
          <Upload className="w-5 h-5" style={{ color: "#0ea5e9" }} />
        </div>
        <p className="text-sm font-semibold text-gray-900">
          {uploading ? "Import in corso..." : title}
        </p>
        <p className="text-[11px] text-gray-500 text-center">
          Trascina il file .xlsx qui o clicca per selezionarlo · Anno {anno}
        </p>
        <p className="text-[10px] text-gray-400 text-center font-mono">
          {formatHint}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {result && (
        <div
          className="rounded-2xl p-3 flex items-start gap-3"
          style={{
            background: result.ok > 0 ? "#dcfce7" : "#fee2e2",
            color: result.ok > 0 ? "#166534" : "#991b1b",
          }}
        >
          {result.ok > 0 ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {result.ok} righe importate con successo
              {result.errors.length > 0
                ? ` · ${result.errors.length} errori`
                : ""}
            </p>
            {result.errors.length > 0 && (
              <ul className="text-xs mt-1 space-y-0.5 opacity-80">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>… +{result.errors.length - 5} altri</li>
                )}
              </ul>
            )}
          </div>
          <button
            onClick={() => setResult(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper che renderizza un bottone "Importa CSV" e apre un modal
// contenente l'ExcelUploadBox. Stessi prop del box, gestisce open/close.
function ExcelUploadModalButton({
  anno,
  endpoint,
  title,
  formatHint,
  buildBatch,
  onImported,
}: {
  anno: number;
  endpoint: "fareharbor" | "stripe" | "gyg";
  title: string;
  formatHint: string;
  buildBatch: (
    rows: Record<string, unknown>[],
    anno: number,
  ) => { payloads: Record<string, unknown>[]; errors: string[] };
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
      >
        <Upload className="w-4 h-4" /> Importa CSV
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-modal rounded-2xl w-full max-w-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            style={{ textAlign: "left" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Importa CSV</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ExcelUploadBox
              anno={anno}
              endpoint={endpoint}
              title={title}
              formatHint={formatHint}
              buildBatch={buildBatch}
              onImported={() => {
                onImported();
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
