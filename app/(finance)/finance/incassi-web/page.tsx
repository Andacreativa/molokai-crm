"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, MESI, ANNI } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface FHRow {
  id?: number;
  anno: number;
  mese: number;
  sett1: number;
  sett2: number;
  sett3: number;
  sett4: number;
  totale: number;
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
        {([
          ["fareharbor", "FareHarbor"],
          ["stripe", "Stripe"],
          ["gyg", "Get Your Guide"],
        ] as const).map(([key, label]) => {
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

// ─── FareHarbor Tab ────────────────────────────────────────────────────

function FareHarborTab({ anno }: { anno: number }) {
  const [rows, setRows] = useState<FHRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    const res = await fetch(`/api/incassi-web/fareharbor?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const rowFor = (mese: number): FHRow =>
    rows.find((r) => r.mese === mese) ?? {
      anno,
      mese,
      sett1: 0,
      sett2: 0,
      sett3: 0,
      sett4: 0,
      totale: 0,
    };

  const totaleAnno = useMemo(
    () => rows.reduce((s, r) => s + r.totale, 0),
    [rows],
  );

  const save = async (
    mese: number,
    patch: Partial<Pick<FHRow, "sett1" | "sett2" | "sett3" | "sett4">>,
  ) => {
    setSaving(mese);
    const current = rowFor(mese);
    const next = { ...current, ...patch };
    try {
      const res = await fetch("/api/incassi-web/fareharbor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anno,
          mese,
          sett1: next.sett1,
          sett2: next.sett2,
          sett3: next.sett3,
          sett4: next.sett4,
        }),
      });
      const saved: FHRow = await res.json();
      setRows((prev) => {
        const idx = prev.findIndex((r) => r.mese === mese);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy;
        }
        return [...prev, saved].sort((a, b) => a.mese - b.mese);
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <StatCard label={`Totale FareHarbor ${anno}`} value={totaleAnno} />

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Mese", "Sett 1", "Sett 2", "Sett 3", "Sett 4", "Totale"].map(
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
              {MESI.map((mese, idx) => {
                const m = idx + 1;
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
                    {(["sett1", "sett2", "sett3", "sett4"] as const).map((k) => (
                      <td key={k} className="px-2 py-1 text-right">
                        <EuroInput
                          value={r[k]}
                          onSave={(v) => save(m, { [k]: v })}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm font-bold text-right" style={{ color: "#0ea5e9" }}>
                      {fmt(r.totale)}
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

// ─── Stripe Tab ────────────────────────────────────────────────────────

function StripeTab({ anno }: { anno: number }) {
  const [rows, setRows] = useState<StripeRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

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
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard label={`Lordo ${anno}`} value={totals.lordo} />
        <StatCard label="Commissioni" value={totals.commissioni} color="#64748b" />
        <StatCard label="Rimborsi" value={totals.rimborsi} color="#ef4444" />
        <StatCard label="Netto" value={totals.netto} color="#0ea5e9" />
      </div>

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
              {MESI.map((mese, idx) => {
                const m = idx + 1;
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
                      <EuroInput value={r.lordo} onSave={(v) => save(m, { lordo: v })} />
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
                    <td className="px-4 py-2 text-sm font-bold text-right" style={{ color: "#0ea5e9" }}>
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

function GYGTab({ anno }: { anno: number }) {
  const [rows, setRows] = useState<GYGRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);

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
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={`Lordo ${anno}`} value={totals.lordo} />
        <StatCard label="Commissioni (25%)" value={totals.commissioni} color="#64748b" />
        <StatCard label="Netto" value={totals.netto} color="#0ea5e9" />
      </div>

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
              {MESI.map((mese, idx) => {
                const m = idx + 1;
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
                    <td className="px-4 py-2 text-sm font-bold text-right" style={{ color: "#0ea5e9" }}>
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

function EuroInput({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState<string>(String(value || 0));

  // Aggiorna lo stato locale quando il value esterno cambia (es. dopo save)
  useEffect(() => {
    setV(String(value || 0));
  }, [value]);

  return (
    <input
      type="number"
      step="0.01"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = round2(parseFloat(v) || 0);
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
