"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { fmt, MESI, ANNI } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface MeseDetail {
  mese: number;
  entrate: {
    soci: number;
    buoni: number;
    fareharbor: number;
    stripe: number;
    gyg: number;
    cassa: number;
    gruppi: number;
    altri: number;
    totale: number;
  };
  uscite: {
    spese: number;
    speseFisse: number;
    collaboratori: number;
    totale: number;
  };
  bilancio: number;
}

interface BilancioData {
  anno: number;
  mesiAttiviFisse: number;
  mensili: MeseDetail[];
  cumulativoMensile: number[];
  totali: { entrate: number; uscite: number; bilancio: number };
  breakdown: {
    entrate: Record<string, number>;
    uscite: Record<string, number>;
  };
}

// Palette per i grafici
const ENTRATA_COLORS: Record<string, string> = {
  Soci: "#0ea5e9",
  Buoni: "#0284c7",
  FareHarbor: "#22c55e",
  Stripe: "#8b5cf6",
  "Get Your Guide": "#f59e0b",
  Cassa: "#06b6d4",
  Gruppi: "#ec4899",
  "Altri Ingressi": "#10b981",
};

const USCITA_COLORS: Record<string, string> = {
  Scuola: "#5BB8E8",
  Rappresentanza: "#9B6ED4",
  "Materiale Sportivo": "#4DD68C",
  Affitto: "#AAAAAA",
  Utenze: "#F5D020",
  Marketing: "#FF6B6B",
  Assicurazione: "#5BA9D8",
  Commercialista: "#8DB84A",
  Tasse: "#FF9940",
  Stipendio: "#5BB8E8",
  "Seguridad Social": "#FF6B6B",
  "Spese Fisse": "#a16207",
  Collaboratori: "#ef4444",
  Altro: "#B0B0B0",
};

const colorFor = (
  map: Record<string, string>,
  key: string,
  fallback: string,
): string => map[key] ?? fallback;

// ─── Page ──────────────────────────────────────────────────────────────

export default function BilancioPage() {
  const [data, setData] = useState<BilancioData | null>(null);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bilancio?anno=${anno}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [anno]);

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bilancio</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "Caricamento..." : "—"}
          </p>
        </div>
      </div>
    );
  }

  // Dati per grafico bar mensile
  const chartData = data.mensili.map((m, i) => ({
    mese: MESI[i].slice(0, 3),
    Entrate: m.entrate.totale,
    Uscite: m.uscite.totale,
    Bilancio: m.bilancio,
  }));

  // Dati per pie entrate
  const entrateData = Object.entries(data.breakdown.entrate)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  const usciteData = Object.entries(data.breakdown.uscite)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bilancio</h1>
          <p className="text-gray-500 text-sm mt-1">
            Riepilogo entrate, uscite e bilancio · anno {anno}
          </p>
        </div>
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
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI
          label={`Entrate ${anno}`}
          value={data.totali.entrate}
          color="#0ea5e9"
        />
        <KPI
          label={`Uscite ${anno}`}
          value={data.totali.uscite}
          color="#ef4444"
        />
        <KPI
          label="Bilancio"
          value={data.totali.bilancio}
          color={data.totali.bilancio >= 0 ? "#22c55e" : "#ef4444"}
        />
      </div>

      {/* Grafico bar Entrate vs Uscite per mese */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">
          Entrate vs Uscite per mese
        </h3>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis
                dataKey="mese"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickFormatter={(v: number) => `€${v}`}
              />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                }}
              />
              <Legend />
              <Bar dataKey="Entrate" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Uscite" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabella mensile */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Mese",
                  "Entrate",
                  "Uscite",
                  "Bilancio Mese",
                  "Bilancio Cumulativo",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${
                      h === "Mese" ? "text-left" : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {data.mensili.map((m, i) => {
                const cum = data.cumulativoMensile[i];
                return (
                  <tr key={m.mese} className="border-b border-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {MESI[i]}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-semibold text-right"
                      style={{
                        color: m.entrate.totale > 0 ? "#0ea5e9" : "#cbd5e1",
                      }}
                    >
                      {fmt(m.entrate.totale)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-semibold text-right"
                      style={{
                        color: m.uscite.totale > 0 ? "#ef4444" : "#cbd5e1",
                      }}
                    >
                      {fmt(m.uscite.totale)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{
                        color: m.bilancio >= 0 ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {fmt(m.bilancio)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-bold text-right"
                      style={{ color: cum >= 0 ? "#22c55e" : "#ef4444" }}
                    >
                      {fmt(cum)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="px-4 py-3 text-sm font-bold text-gray-900 uppercase">
                  Totale
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold text-right"
                  style={{ color: "#0ea5e9" }}
                >
                  {fmt(data.totali.entrate)}
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold text-right"
                  style={{ color: "#ef4444" }}
                >
                  {fmt(data.totali.uscite)}
                </td>
                <td
                  className="px-4 py-3 text-sm font-bold text-right"
                  style={{
                    color: data.totali.bilancio >= 0 ? "#22c55e" : "#ef4444",
                  }}
                >
                  {fmt(data.totali.bilancio)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-400">
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown grafici */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BreakdownCard
          title="Breakdown Entrate"
          data={entrateData}
          colors={ENTRATA_COLORS}
          totale={data.totali.entrate}
          fallbackColor="#0ea5e9"
        />
        <BreakdownCard
          title="Breakdown Uscite"
          data={usciteData}
          colors={USCITA_COLORS}
          totale={data.totali.uscite}
          fallbackColor="#ef4444"
        />
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
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

function BreakdownCard({
  title,
  data,
  colors,
  totale,
  fallbackColor,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
  colors: Record<string, string>;
  totale: number;
  fallbackColor: string;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div className="glass-card rounded-2xl p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-8 text-center">
          Nessun dato per questo periodo
        </p>
      ) : (
        <>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={sorted}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {sorted.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={colorFor(colors, entry.name, fallbackColor)}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {sorted.map((d) => {
              const pct = totale > 0 ? (d.value / totale) * 100 : 0;
              return (
                <div
                  key={d.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded"
                      style={{
                        background: colorFor(colors, d.name, fallbackColor),
                      }}
                    />
                    <span className="text-gray-700">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {fmt(d.value)}
                    </span>
                    <span className="text-gray-400 text-[10px] w-10 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
