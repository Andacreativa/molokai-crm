"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Receipt,
  Anchor,
  CreditCard,
  Map,
  Store,
  School,
} from "lucide-react";
import {
  fmt,
  MESI,
  ANNI,
  CATEGORIE_COLORI,
  CATEGORIA_TEXT,
} from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface MeseAgg {
  mese: number;
  entrate: number;
  uscite: number;
  bilancio: number;
}

interface UltimoSocio {
  id: number;
  nome: string;
  cognome: string | null;
  piano: string;
  prezzoPiano: number;
  stato: string;
  createdAt: string;
}

interface UltimaSpesa {
  id: number;
  data: string;
  fornitore: string;
  categoria: string;
  importo: number;
  createdAt: string;
}

interface DashboardData {
  anno: number;
  meseCorrente: number;
  sociAttivi: number;
  meseCorrenteData: { entrate: number; uscite: number; bilancio: number };
  annoData: { entrate: number; uscite: number; bilancio: number };
  mensili: MeseAgg[];
  breakdownEntrate: Record<string, number>;
  ultimiSoci: UltimoSocio[];
  ultimeSpese: UltimaSpesa[];
}

const ENTRATA_COLORS: Record<string, string> = {
  Soci: "#0ea5e9",
  Buoni: "#0284c7",
  FareHarbor: "#22c55e",
  Stripe: "#8b5cf6",
  "Get Your Guide": "#f59e0b",
  Cassa: "#06b6d4",
  Gruppi: "#ec4899",
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [anno, setAnno] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?anno=${anno}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [anno]);

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "Caricamento..." : "—"}
          </p>
        </div>
      </div>
    );
  }

  const meseCorrenteName = MESI[data.meseCorrente - 1];

  const chartData = data.mensili.map((m, i) => ({
    mese: MESI[i].slice(0, 3),
    Entrate: m.entrate,
    Uscite: m.uscite,
  }));

  const pieData = Object.entries(data.breakdownEntrate)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const bilancioAnno = data.annoData.bilancio;
  const bilancioMese = data.meseCorrenteData.bilancio;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Molokai Barcelona · {meseCorrenteName} {anno}
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

      {/* KPI cards anno */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          label={`Entrate ${anno}`}
          value={fmt(data.annoData.entrate)}
          color="#0ea5e9"
          icon={TrendingUp}
        />
        <KPI
          label={`Uscite ${anno}`}
          value={fmt(data.annoData.uscite)}
          color="#ef4444"
          icon={TrendingDown}
        />
        <KPI
          label="Bilancio Annuale"
          value={fmt(bilancioAnno)}
          color={bilancioAnno >= 0 ? "#22c55e" : "#ef4444"}
          icon={Wallet}
        />
        <KPI
          label="Soci Attivi"
          value={String(data.sociAttivi)}
          color="#0ea5e9"
          icon={Users}
        />
      </div>

      {/* Box compatto mese corrente */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <YearStat
          label={`Entrate ${meseCorrenteName}`}
          value={data.meseCorrenteData.entrate}
          color="#0ea5e9"
        />
        <YearStat
          label={`Uscite ${meseCorrenteName}`}
          value={data.meseCorrenteData.uscite}
          color="#ef4444"
        />
        <YearStat
          label={`Bilancio ${meseCorrenteName}`}
          value={bilancioMese}
          color={bilancioMese >= 0 ? "#22c55e" : "#ef4444"}
        />
      </div>

      {/* Riga canali di incasso (annuale) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <ChannelCard
          label="FareHarbor"
          value={data.breakdownEntrate["FareHarbor"] ?? 0}
          color="#22c55e"
          icon={Anchor}
        />
        <ChannelCard
          label="Get Your Guide"
          value={data.breakdownEntrate["Get Your Guide"] ?? 0}
          color="#f59e0b"
          icon={Map}
        />
        <ChannelCard
          label="Stripe"
          value={data.breakdownEntrate["Stripe"] ?? 0}
          color="#8b5cf6"
          icon={CreditCard}
        />
        <ChannelCard
          label="Incassi Scuola"
          value={data.breakdownEntrate["Cassa"] ?? 0}
          color="#06b6d4"
          icon={Store}
        />
        <ChannelCard
          label="Gruppi"
          value={data.breakdownEntrate["Gruppi"] ?? 0}
          color="#ec4899"
          icon={School}
        />
        <ChannelCard
          label="Soci"
          value={data.breakdownEntrate["Soci"] ?? 0}
          color="#0ea5e9"
          icon={Users}
        />
      </div>

      {/* Grafici: bar + pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Entrate vs Uscite — {anno}
          </h3>
          <div style={{ width: "100%", height: 280 }}>
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
                <Bar dataKey="Entrate" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Uscite" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            Entrate per canale
          </h3>
          {pieData.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-12 text-center">
              Nessuna entrata per {anno}
            </p>
          ) : (
            <>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={ENTRATA_COLORS[entry.name] ?? "#0ea5e9"}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {[...pieData]
                  .sort((a, b) => b.value - a.value)
                  .map((d) => {
                    const pct =
                      data.annoData.entrate > 0
                        ? (d.value / data.annoData.entrate) * 100
                        : 0;
                    return (
                      <div
                        key={d.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded shrink-0"
                            style={{
                              background: ENTRATA_COLORS[d.name] ?? "#0ea5e9",
                            }}
                          />
                          <span className="text-gray-700 truncate">
                            {d.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {fmt(d.value)}
                          </span>
                          <span className="text-gray-400 text-[10px] w-10 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Liste rapide: ultimi soci, ultime spese */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: "#0ea5e9" }} />
              Ultimi soci aggiunti
            </h3>
            <a
              href="/finance/club"
              className="text-xs text-sky-600 hover:text-sky-700 font-medium"
            >
              Vedi tutti →
            </a>
          </div>
          {data.ultimiSoci.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">
              Nessun socio
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.ultimiSoci.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background:
                          s.stato === "ATTIVO"
                            ? "#22c55e"
                            : s.stato === "SOSPESO"
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {s.nome} {s.cognome ?? ""}
                      </p>
                      <p className="text-[10px] text-gray-500">{s.piano}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    {fmt(s.prezzoPiano)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-4 h-4" style={{ color: "#ef4444" }} />
              Ultime spese
            </h3>
            <a
              href="/finance/spese"
              className="text-xs text-sky-600 hover:text-sky-700 font-medium"
            >
              Vedi tutte →
            </a>
          </div>
          {data.ultimeSpese.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-6 text-center">
              Nessuna spesa
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.ultimeSpese.map((s) => {
                const bg = CATEGORIE_COLORI[s.categoria] ?? "#EDEDED";
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: bg, color: CATEGORIA_TEXT }}
                      >
                        {s.categoria}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {s.fornitore}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(s.data).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-gray-900">
                      {fmt(s.importo)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function KPI({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            {label}
          </p>
          <p
            className="text-xl sm:text-2xl font-bold mt-1 truncate"
            style={{ color }}
          >
            {value}
          </p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function YearStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-lg font-bold mt-0.5" style={{ color }}>
        {fmt(value)}
      </p>
    </div>
  );
}

function ChannelCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
}) {
  return (
    <div className="glass-card rounded-xl p-3 flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold truncate">
          {label}
        </p>
        <p className="text-sm font-bold mt-0.5 truncate" style={{ color }}>
          {fmt(value)}
        </p>
      </div>
    </div>
  );
}
