"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Trash2,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { fmt, MESI, ANNI } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface PagamentoScuola {
  id: number;
  data: string; // ISO
  mese: number;
  anno: number;
  totaleGiorno: number; // SALE
  totVendite: number; // TOTALSALES
  rimborsi: number; // REFUND
  note: string | null;
}

interface ParsedRow {
  data: string;
  totaleGiorno: number;
  totVendite: number;
  rimborsi: number;
}

// ─── CSV parsing ───────────────────────────────────────────────────────

// Formato atteso: DATE;SALE;CURRENCY;TOTALSALES;REFUND;CURRENCY;TOTALREFUND
// Salviamo: DATE (col 0), SALE (col 1), TOTALSALES (col 3), REFUND (col 4).
// Le colonne CURRENCY e TOTALREFUND vengono ignorate.
// Separatore: ;
function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Parser numerico tollerante: "1.234,50" → 1234.50, "40.00" → 40.
  // Ambiguità: "1.234" potrebbe essere 1234 (it) o 1.234 (en). Euristica:
  // se c'è una sola occorrenza di "." e poi 1-2 cifre, trattala come decimale
  // (formato inglese). Se ci sono virgole, trattale come decimali (italiano).
  const cleanNum = (s: string) => {
    const raw = s.trim();
    if (!raw) return 0;
    if (raw.includes(",")) {
      return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(raw) || 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(";").map((c) => c.trim());
    if (cols.length < 5) {
      if (i === 0) continue;
      errors.push(`Riga ${i + 1}: attese ≥5 colonne, trovate ${cols.length}`);
      continue;
    }
    const [dateStr, saleStr, , totalSalesStr, refundStr] = cols;

    const looksLikeDate =
      /^\d{4}-\d{2}-\d{2}/.test(dateStr) ||
      /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr);
    if (!looksLikeDate) {
      if (i === 0) continue; // header
      errors.push(`Riga ${i + 1}: data non valida "${dateStr}"`);
      continue;
    }

    rows.push({
      data: dateStr,
      totaleGiorno: cleanNum(saleStr),
      totVendite: cleanNum(totalSalesStr),
      rimborsi: cleanNum(refundStr),
    });
  }

  return { rows, errors };
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function IncassiScuolaPage() {
  const now = new Date();
  const [anno, setAnno] = useState(now.getFullYear());
  // mese === null → vista completa anno (no filter mese)
  const [mese, setMese] = useState<number | null>(now.getMonth() + 1);
  const [rows, setRows] = useState<PagamentoScuola[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch full-year: la tabella filtra per mese client-side, il box
  // riepilogo usa tutte le righe dell'anno.
  const load = async () => {
    const res = await fetch(`/api/incassi-scuola?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const rowsMese = useMemo(
    () => (mese === null ? rows : rows.filter((r) => r.mese === mese)),
    [rows, mese],
  );

  const stats = useMemo(
    () =>
      rowsMese.reduce(
        (acc, r) => ({
          totaleGiorno: acc.totaleGiorno + r.totaleGiorno,
          totVendite: acc.totVendite + r.totVendite,
          rimborsi: acc.rimborsi + r.rimborsi,
        }),
        { totaleGiorno: 0, totVendite: 0, rimborsi: 0 },
      ),
    [rowsMese],
  );

  // IVA mese corrente: base = totale / 1.21, IVA = totale - base.
  // "Totale incassato" = somma totaleGiorno (SALE) del mese selezionato.
  const ivaTotale = Math.round(stats.totaleGiorno * 100) / 100;
  const ivaBase = Math.round((ivaTotale / 1.21) * 100) / 100;
  const ivaImporto = Math.round((ivaTotale - ivaBase) * 100) / 100;

  // Riepilogo mensile (tutto l'anno) = somma totaleGiorno per mese
  const totaliMensili = Array(12).fill(0) as number[];
  for (const r of rows) totaliMensili[r.mese - 1] += r.totaleGiorno;
  const totaleAnno = totaliMensili.reduce((a, b) => a + b, 0);

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const text = await file.text();
      const { rows: parsed, errors: parseErrors } = parseCSV(text);
      if (parsed.length === 0) {
        setResult({
          ok: 0,
          errors: ["Nessuna riga valida nel file", ...parseErrors],
        });
        return;
      }
      const res = await fetch("/api/incassi-scuola", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ righe: parsed }),
      });
      const data = await res.json();
      setResult({
        ok: data.ok ?? 0,
        errors: [...(data.errors ?? []), ...parseErrors],
      });
      load();
    } catch (e) {
      setResult({
        ok: 0,
        errors: [String(e)],
      });
    } finally {
      setUploading(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Eliminare questo pagamento?")) return;
    await fetch(`/api/incassi-scuola/${id}`, { method: "DELETE" });
    load();
  };

  // Inline-edit helpers: update locale immediato (per IVA recap live), PUT on blur.
  const updateRowLocal = (id: number, patch: Partial<PagamentoScuola>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveField = async (
    id: number,
    field: "data" | "totaleGiorno" | "totVendite" | "rimborsi",
    value: string,
  ) => {
    try {
      const res = await fetch(`/api/incassi-scuola/${id}`, {
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
      const updated: PagamentoScuola = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      alert(String(e));
      load();
    }
  };

  const isoDate = (d: string) => new Date(d).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Incassi Scuola</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pagamenti in cassa (importazione da CSV)
        </p>
      </div>

      {/* Upload zone */}
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
        onClick={() => fileInputRef.current?.click()}
        className="glass-card rounded-2xl p-8 border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
        style={{
          borderColor: dragActive ? "#0ea5e9" : "#cbd5e1",
          background: dragActive ? "#f0f9ff" : undefined,
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
          Formato atteso:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
            DATE;SALE;CURRENCY;TOTALSALES;REFUND;CURRENCY;TOTALREFUND
          </code>
          <br />
          Upsert per data: righe con stessa data vengono sovrascritte.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Result banner */}
      {result && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
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
              {result.errors.length > 0 && `, ${result.errors.length} errori`}
            </p>
            {result.errors.length > 0 && (
              <ul className="text-xs mt-1 space-y-0.5 opacity-80">
                {result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {result.errors.length > 10 && (
                  <li>… +{result.errors.length - 10} altri</li>
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

      {/* Filtri */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={anno}
          onChange={(e) => setAnno(parseInt(e.target.value))}
          className="text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 outline-none"
        >
          {ANNI.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          {mese === null
            ? "Tutti i mesi"
            : `Filtro: ${MESI[mese - 1]} — clicca di nuovo sul mese per rimuovere`}
        </span>
      </div>

      {/* Riepilogo mensile incassi scuola (tutto l'anno) */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo incassi mensili scuola
          </h3>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {MESI.map((meseNome, idx) => {
            const m = idx + 1;
            const tot = totaliMensili[idx];
            const hasValue = tot > 0;
            const isActive = mese === m;
            // 3 stati visivi: attivo (blu pieno), con dati (blu chiaro), vuoto (bianco)
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
                onClick={() => setMese(isActive ? null : m)}
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
                  className="text-xs font-bold"
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

      {/* Tabella */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Data", "Totale Giorno", "Tot. Vendite", "Rimborsi", ""].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${i === 0 || i === 4 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ),
                )}
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
                    {mese === null ? anno : `${MESI[mese - 1]} ${anno}`}
                  </td>
                </tr>
              )}
              {rowsMese.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={isoDate(r.data)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const d = new Date(v);
                        updateRowLocal(r.id, {
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
                  <td className="px-2 py-1.5">
                    <EditableNumber
                      value={r.totaleGiorno}
                      onChange={(v) =>
                        updateRowLocal(r.id, { totaleGiorno: v })
                      }
                      onSave={(v) => saveField(r.id, "totaleGiorno", String(v))}
                      color="#0ea5e9"
                      bold
                      currency
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableNumber
                      value={r.totVendite}
                      onChange={(v) => updateRowLocal(r.id, { totVendite: v })}
                      onSave={(v) => saveField(r.id, "totVendite", String(v))}
                      integer
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableNumber
                      value={r.rimborsi}
                      onChange={(v) => updateRowLocal(r.id, { rimborsi: v })}
                      onSave={(v) => saveField(r.id, "rimborsi", String(v))}
                      color={r.rimborsi > 0 ? "#ef4444" : undefined}
                      currency
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

      {/* Riepilogo IVA mensile */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo IVA —{" "}
            {mese === null ? `Anno ${anno}` : `${MESI[mese - 1]} ${anno}`}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="rounded-xl p-4"
            style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
          >
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
              Totale incassato
            </p>
            <p className="text-[10px] text-gray-400 mb-1">IVA inclusa</p>
            <p className="text-xl font-bold" style={{ color: "#0ea5e9" }}>
              {fmt(ivaTotale)}
            </p>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
          >
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
              Base imponibile
            </p>
            <p className="text-[10px] text-gray-400 mb-1">totale ÷ 1,21</p>
            <p className="text-xl font-bold text-gray-900">{fmt(ivaBase)}</p>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ background: "#fef9c3", border: "1px solid #fde047" }}
          >
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
              IVA 21%
            </p>
            <p className="text-[10px] text-gray-400 mb-1">totale − base</p>
            <p className="text-xl font-bold" style={{ color: "#a16207" }}>
              {fmt(ivaImporto)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Editable number cell ──────────────────────────────────────────────

function EditableNumber({
  value,
  onChange,
  onSave,
  color,
  bold,
  integer,
  currency,
}: {
  value: number;
  onChange: (v: number) => void;
  onSave: (v: number) => void;
  color?: string;
  bold?: boolean;
  // integer: step=1, niente simbolo €, parsing con parseInt
  integer?: boolean;
  // currency: display "€12,34" quando non focused, raw "12.34" in edit, parser IT/EN
  currency?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const savedRef = useRef(value);

  const parse = (s: string): number => {
    if (integer) return parseInt(s, 10) || 0;
    const t = s.trim();
    if (!t) return 0;
    if (t.includes(",")) {
      return parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(t) || 0;
  };

  const baseCls = `w-full text-sm text-right px-2 py-1.5 rounded-md border border-transparent hover:border-gray-200 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white bg-transparent ${bold ? "font-bold" : "font-semibold"}`;

  if (currency) {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={editing ? editValue : fmt(value)}
        onFocus={(e) => {
          savedRef.current = value;
          setEditing(true);
          setEditValue(value.toFixed(2));
          setTimeout(() => e.target.select(), 0);
        }}
        onChange={(e) => {
          setEditValue(e.target.value);
          onChange(parse(e.target.value));
        }}
        onBlur={() => {
          setEditing(false);
          const v = parse(editValue);
          if (Math.abs(v - savedRef.current) > 0.005) onSave(v);
        }}
        className={baseCls}
        style={color ? { color } : undefined}
      />
    );
  }

  return (
    <input
      type="number"
      step={integer ? "1" : "0.01"}
      value={value}
      onChange={(e) => onChange(parse(e.target.value))}
      onFocus={(e) => {
        e.currentTarget.dataset.initial = e.currentTarget.value;
      }}
      onBlur={(e) => {
        const initial = e.currentTarget.dataset.initial;
        if (e.currentTarget.value !== initial) {
          onSave(parse(e.currentTarget.value));
        }
      }}
      className={baseCls}
      style={color ? { color } : undefined}
    />
  );
}
