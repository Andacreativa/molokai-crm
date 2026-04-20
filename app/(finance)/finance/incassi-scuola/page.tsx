"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmt, MESI, ANNI } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface PagamentoScuola {
  id: number;
  data: string; // ISO
  mese: number;
  anno: number;
  importo: number;
  nTransazioni: number;
  rimborsi: number;
  nRimborsi: number;
  note: string | null;
}

interface ParsedRow {
  data: string;
  nTransazioni: number;
  totaleSales: number;
  nRimborsi: number;
  totaleRimborsi: number;
}

// ─── CSV parsing ───────────────────────────────────────────────────────

// Formato atteso: DATE;SALE;CURRENCY;TOTALSALES;REFUND;CURRENCY;TOTALREFUND
// Separatore: ;
// Prima riga può essere header (la saltiamo se la prima colonna non parsa come data).
function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(";").map((c) => c.trim());
    if (cols.length < 7) {
      // Skip silently se è troppo corta (es. riga vuota o separatore diverso)
      if (i === 0) continue; // probabile header
      errors.push(`Riga ${i + 1}: attese 7 colonne, trovate ${cols.length}`);
      continue;
    }
    const [dateStr, saleStr, , totalSalesStr, refundStr, , totalRefundStr] = cols;

    // Skip header (se prima colonna non è una data)
    const looksLikeDate =
      /^\d{4}-\d{2}-\d{2}/.test(dateStr) ||
      /^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr);
    if (!looksLikeDate) {
      if (i === 0) continue; // header
      errors.push(`Riga ${i + 1}: data non valida "${dateStr}"`);
      continue;
    }

    const cleanNum = (s: string) =>
      parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

    rows.push({
      data: dateStr,
      nTransazioni: parseInt(saleStr) || 0,
      totaleSales: cleanNum(totalSalesStr),
      nRimborsi: parseInt(refundStr) || 0,
      totaleRimborsi: cleanNum(totalRefundStr),
    });
  }

  return { rows, errors };
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function IncassiScuolaPage() {
  const now = new Date();
  const [anno, setAnno] = useState(now.getFullYear());
  const [mese, setMese] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<PagamentoScuola[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    ok: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const params = new URLSearchParams();
    params.set("anno", String(anno));
    params.set("mese", String(mese));
    const res = await fetch(`/api/incassi-scuola?${params}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno, mese]);

  const stats = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          importo: acc.importo + r.importo,
          rimborsi: acc.rimborsi + r.rimborsi,
          nTransazioni: acc.nTransazioni + r.nTransazioni,
          nRimborsi: acc.nRimborsi + r.nRimborsi,
        }),
        { importo: 0, rimborsi: 0, nTransazioni: 0, nRimborsi: 0 },
      ),
    [rows],
  );
  const netto = stats.importo - stats.rimborsi;

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
              {result.errors.length > 0 &&
                `, ${result.errors.length} errori`}
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
        <select
          value={mese}
          onChange={(e) => setMese(parseInt(e.target.value))}
          className="text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 outline-none"
        >
          {MESI.map((m, idx) => (
            <option key={m} value={idx + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Incassato" value={fmt(stats.importo)} />
        <StatCard
          label="Rimborsi"
          value={fmt(stats.rimborsi)}
          color="#ef4444"
        />
        <StatCard label="Netto" value={fmt(netto)} color="#0ea5e9" />
        <StatCard
          label="Transazioni"
          value={`${stats.nTransazioni}${stats.nRimborsi > 0 ? ` (−${stats.nRimborsi} ref)` : ""}`}
          color="#64748b"
        />
      </div>

      {/* Tabella */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Data", "Importo", "N° Trans.", "Rimborsi", "N° Ref.", "Netto", ""].map(
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
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    Nessun incasso per {MESI[mese - 1]} {anno}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const netto = r.importo - r.rimborsi;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(r.data).toLocaleDateString("it-IT")}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">
                      {fmt(r.importo)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {r.nTransazioni}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-semibold text-right"
                      style={{ color: r.rimborsi > 0 ? "#ef4444" : "#cbd5e1" }}
                    >
                      {r.rimborsi > 0 ? fmt(r.rimborsi) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {r.nRimborsi || "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{ color: "#0ea5e9" }}
                    >
                      {fmt(netto)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-xl font-bold mt-1 truncate" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
