"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Package2,
  Search,
  MoreVertical,
} from "lucide-react";
import { fmt } from "@/lib/constants";

// ─── Types ─────────────────────────────────────────────────────────────

interface Categoria {
  id: number;
  nome: string;
  ordine: number;
  _count?: { items: number };
}

interface Item {
  id: number;
  categoriaId: number;
  marca: string | null;
  modello: string | null;
  taglia: string | null;
  lunghezza: string | null;
  volume: string | null;
  numeroSerie: string | null;
  colore: string | null;
  quantita: number;
  stato: string;
  note: string | null;
  dataAcquisto: string | null;
  costoAcquisto: number | null;
}

const STATI = ["Nuovo", "Usato", "Vecchio", "Fuori uso"];

const STATO_BADGE: Record<string, { bg: string; text: string }> = {
  Nuovo: { bg: "#dcfce7", text: "#166534" },
  Usato: { bg: "#e0f2fe", text: "#0369a1" },
  Vecchio: { bg: "#fef3c7", text: "#92400e" },
  "Fuori uso": { bg: "#fee2e2", text: "#991b1b" },
};

const emptyItem = {
  marca: "",
  modello: "",
  taglia: "",
  lunghezza: "",
  volume: "",
  numeroSerie: "",
  colore: "",
  quantita: "1",
  stato: "Nuovo",
  note: "",
  dataAcquisto: "",
  costoAcquisto: "",
};

const isoDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const loadCategorie = async () => {
    const res = await fetch("/api/inventario/categorie");
    const data = await res.json();
    const list: Categoria[] = Array.isArray(data) ? data : [];
    setCategorie(list);
    if (selectedCatId === null && list.length > 0) {
      setSelectedCatId(list[0].id);
    }
    if (selectedCatId !== null && !list.find((c) => c.id === selectedCatId)) {
      setSelectedCatId(list[0]?.id ?? null);
    }
  };

  const loadItems = async (catId: number) => {
    const res = await fetch(`/api/inventario/items?categoriaId=${catId}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadCategorie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCatId !== null) loadItems(selectedCatId);
    else setItems([]);
  }, [selectedCatId]);

  const selectedCat = categorie.find((c) => c.id === selectedCatId);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [
        i.marca,
        i.modello,
        i.taglia,
        i.lunghezza,
        i.volume,
        i.numeroSerie,
        i.colore,
        i.note,
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [items, search]);

  // Counter su items (non filtrati): somma quantita per stato
  const counts = useMemo(() => {
    const sumBy = (pred: (i: Item) => boolean) =>
      items.filter(pred).reduce((s, i) => s + i.quantita, 0);
    const totale = items.reduce((s, i) => s + i.quantita, 0);
    return {
      totale,
      nuovi: sumBy((i) => i.stato === "Nuovo"),
      vecchi: sumBy((i) => i.stato === "Vecchio" || i.stato === "Usato"),
      fuoriUso: sumBy((i) => i.stato === "Fuori uso"),
    };
  }, [items]);

  const delItem = async (id: number) => {
    if (!confirm("Eliminare questo item?")) return;
    await fetch(`/api/inventario/items/${id}`, { method: "DELETE" });
    if (selectedCatId !== null) loadItems(selectedCatId);
    loadCategorie();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 text-sm mt-1">
            {categorie.length} categorie ·{" "}
            {categorie.reduce((s, c) => s + (c._count?.items ?? 0), 0)} items
            totali
          </p>
        </div>
      </div>

      {/* Layout 2 colonne */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
        {/* Sidebar categorie */}
        <aside className="glass-card rounded-2xl p-3 h-fit">
          <div className="flex items-center justify-between px-2 py-1.5 mb-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Categorie
            </span>
            <button
              onClick={() => {
                setEditingCat(null);
                setShowCatForm(true);
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              title="Aggiungi categoria"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-0.5">
            {categorie.length === 0 && (
              <li className="text-xs text-gray-400 px-2 py-4 text-center italic">
                Nessuna categoria
              </li>
            )}
            {categorie.map((c) => {
              const active = c.id === selectedCatId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedCatId(c.id)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group"
                    style={
                      active
                        ? { background: "#e0f2fe", color: "#0369a1" }
                        : { color: "#475569" }
                    }
                  >
                    <span className="truncate">{c.nome}</span>
                    <span className="flex items-center gap-1">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={
                          active
                            ? { background: "#bae6fd", color: "#075985" }
                            : { background: "#f1f5f9", color: "#64748b" }
                        }
                      >
                        {c._count?.items ?? 0}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCat(c);
                          setShowCatForm(true);
                        }}
                        className="p-0.5 rounded text-gray-400 hover:text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Rinomina / elimina"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Contenuto principale */}
        <section className="space-y-4">
          {selectedCat ? (
            <>
              {/* Counter */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <CounterCard label="Totale pezzi" value={counts.totale} />
                <CounterCard
                  label="Nuovi"
                  value={counts.nuovi}
                  color="#16a34a"
                />
                <CounterCard
                  label="Vecchi / Usati"
                  value={counts.vecchi}
                  color="#d97706"
                />
                <CounterCard
                  label="Fuori uso"
                  value={counts.fuoriUso}
                  color="#dc2626"
                />
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Package2
                    className="w-5 h-5"
                    style={{ color: "#0ea5e9" }}
                  />
                  <h2 className="text-lg font-bold text-gray-900">
                    {selectedCat.nome}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cerca marca, modello, seriale…"
                      className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-300 w-full sm:w-72"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setShowItemForm(true);
                    }}
                    className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
                  >
                    <Plus className="w-4 h-4" /> Aggiungi Item
                  </button>
                </div>
              </div>

              {/* Tabella */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[
                          "Marca / Modello",
                          "Taglia",
                          "Lunghezza",
                          "Volume",
                          "Colore",
                          "N. serie",
                          "Qtà",
                          "Stato",
                          "Costo",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === "Qtà" || h === "Costo" ? "text-right" : h === "Stato" ? "text-center" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="zebra">
                      {filteredItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
                            className="text-center text-gray-400 py-12 text-sm"
                          >
                            {items.length === 0
                              ? "Nessun item in questa categoria"
                              : "Nessun risultato"}
                          </td>
                        </tr>
                      )}
                      {filteredItems.map((i) => {
                        const badge = STATO_BADGE[i.stato] ?? STATO_BADGE.Nuovo;
                        return (
                          <tr
                            key={i.id}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm">
                              <div className="font-semibold text-gray-900">
                                {i.marca || "—"}
                              </div>
                              {i.modello && (
                                <div className="text-xs text-gray-500">
                                  {i.modello}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {i.taglia || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {i.lunghezza || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {i.volume || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {i.colore || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                              {i.numeroSerie || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                              {i.quantita}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                style={{
                                  background: badge.bg,
                                  color: badge.text,
                                }}
                              >
                                {i.stato}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {i.costoAcquisto != null
                                ? fmt(i.costoAcquisto)
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingItem(i);
                                    setShowItemForm(true);
                                  }}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                                  title="Modifica"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => delItem(i.id)}
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
            </>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Package2
                className="w-12 h-12 mx-auto mb-3"
                style={{ color: "#cbd5e1" }}
              />
              <p className="text-gray-500 text-sm">
                Aggiungi una categoria per iniziare a gestire l&apos;inventario
              </p>
            </div>
          )}
        </section>
      </div>

      {showCatForm && (
        <CategoriaFormModal
          editing={editingCat}
          canDelete={
            !!editingCat &&
            (categorie.find((c) => c.id === editingCat.id)?._count?.items ??
              0) === 0
          }
          onClose={() => setShowCatForm(false)}
          onSaved={(newId) => {
            setShowCatForm(false);
            loadCategorie();
            if (newId) setSelectedCatId(newId);
          }}
          onDeleted={() => {
            setShowCatForm(false);
            loadCategorie();
          }}
        />
      )}

      {showItemForm && selectedCat && (
        <ItemFormModal
          categoriaId={selectedCat.id}
          editing={editingItem}
          onClose={() => setShowItemForm(false)}
          onSaved={() => {
            setShowItemForm(false);
            loadItems(selectedCat.id);
            loadCategorie();
          }}
        />
      )}
    </div>
  );
}

// ─── Counter Card ──────────────────────────────────────────────────────

function CounterCard({
  label,
  value,
  color,
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
      <p
        className="text-2xl font-bold mt-1"
        style={{ color: color ?? "#0f172a" }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Categoria Form Modal ──────────────────────────────────────────────

function CategoriaFormModal({
  editing,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
}: {
  editing: Categoria | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (newId?: number) => void;
  onDeleted: () => void;
}) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const v = nome.trim();
    if (!v) return;
    setSaving(true);
    setError(null);
    try {
      const res = editing
        ? await fetch(`/api/inventario/categorie/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: v }),
          })
        : await fetch("/api/inventario/categorie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: v }),
          });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Errore");
        return;
      }
      onSaved(editing ? undefined : json.id);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!editing) return;
    if (!confirm(`Eliminare la categoria "${editing.nome}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventario/categorie/${editing.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Errore");
        return;
      }
      onDeleted();
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
        className="glass-modal rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? "Rinomina Categoria" : "Nuova Categoria"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Nome *
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. SUP Board"
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>

        {error && (
          <div className="rounded-xl p-3 bg-red-50 text-red-800 text-xs">
            {error}
          </div>
        )}

        {editing && (
          <p className="text-xs text-gray-500">
            {canDelete
              ? "Questa categoria è vuota e può essere eliminata."
              : "Per eliminarla, rimuovi prima tutti gli items che contiene."}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          {editing && (
            <button
              onClick={del}
              disabled={saving || !canDelete}
              className="border border-red-200 text-red-600 text-sm font-medium py-2.5 px-4 rounded-xl hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              title={canDelete ? "Elimina categoria" : "Categoria non vuota"}
            >
              <Trash2 className="w-4 h-4" /> Elimina
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving || !nome.trim()}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Form Modal ───────────────────────────────────────────────────

function ItemFormModal({
  categoriaId,
  editing,
  onClose,
  onSaved,
}: {
  categoriaId: number;
  editing: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    marca: editing?.marca ?? "",
    modello: editing?.modello ?? "",
    taglia: editing?.taglia ?? "",
    lunghezza: editing?.lunghezza ?? "",
    volume: editing?.volume ?? "",
    numeroSerie: editing?.numeroSerie ?? "",
    colore: editing?.colore ?? "",
    quantita: editing ? String(editing.quantita) : emptyItem.quantita,
    stato: editing?.stato ?? "Nuovo",
    note: editing?.note ?? "",
    dataAcquisto: isoDate(editing?.dataAcquisto),
    costoAcquisto:
      editing?.costoAcquisto != null ? String(editing.costoAcquisto) : "",
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        categoriaId,
        marca: form.marca || null,
        modello: form.modello || null,
        taglia: form.taglia || null,
        lunghezza: form.lunghezza || null,
        volume: form.volume || null,
        numeroSerie: form.numeroSerie || null,
        colore: form.colore || null,
        quantita: parseInt(form.quantita) || 1,
        stato: form.stato,
        note: form.note || null,
        dataAcquisto: form.dataAcquisto || null,
        costoAcquisto: form.costoAcquisto || null,
      };
      if (editing) {
        await fetch(`/api/inventario/items/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/inventario/items", {
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
            {editing ? "Modifica Item" : "Nuovo Item"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label="Marca"
            value={form.marca}
            onChange={(v) => set("marca", v)}
            placeholder="Es. Red Paddle"
          />
          <TextField
            label="Modello"
            value={form.modello}
            onChange={(v) => set("modello", v)}
            placeholder="Es. Ride 10'6"
          />
          <TextField
            label="Taglia"
            value={form.taglia}
            onChange={(v) => set("taglia", v)}
            placeholder="S / M / L / XL"
          />
          <TextField
            label="Lunghezza"
            value={form.lunghezza}
            onChange={(v) => set("lunghezza", v)}
            placeholder="Es. 10'6 / 320cm"
          />
          <TextField
            label="Volume"
            value={form.volume}
            onChange={(v) => set("volume", v)}
            placeholder="Es. 240L"
          />
          <TextField
            label="Colore"
            value={form.colore}
            onChange={(v) => set("colore", v)}
            placeholder="Es. Blu/Bianco"
          />
          <TextField
            label="Numero di serie"
            value={form.numeroSerie}
            onChange={(v) => set("numeroSerie", v)}
            placeholder="SN-…"
            mono
          />
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Quantità *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantita}
              onChange={(e) => set("quantita", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Stato *
            </label>
            <select
              value={form.stato}
              onChange={(e) => set("stato", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              {STATI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Data acquisto
            </label>
            <input
              type="date"
              value={form.dataAcquisto}
              onChange={(e) => set("dataAcquisto", e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Costo acquisto (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.costoAcquisto}
              onChange={(e) => set("costoAcquisto", e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Note
          </label>
          <textarea
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
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
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
