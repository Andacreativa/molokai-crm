"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  X,
  FileDown,
  Upload,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import Papa from "papaparse";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fmt, ANNI, MESI } from "@/lib/constants";
import { calcolaMargini } from "@/lib/prodotti";
import { exportProdottiPDF, type ProdottiPDFSections } from "@/lib/export";

const ANNO = new Date().getFullYear();
const CANALI = ["negozio", "web", "altro", "fareharbor"];
const FH_CANALE = "fareharbor";

type Categoria = "singolo" | "pack";

type Variante = {
  id: number;
  prodottoId: number;
  nome: string;
  prezzoVendita: number;
  ordine: number;
};

type Costo = {
  id: number;
  prodottoId: number;
  nome: string;
  tipo: "fisso" | "percentuale";
  valore: number;
};

type Prodotto = {
  id: number;
  nome: string;
  prezzoVendita: number;
  feePerc?: number | null;
  feeFissa?: number | null;
  ordine: number;
  categoria: Categoria;
  varianti: Variante[];
  costi: Costo[];
};

const CATEGORIA_LABEL: Record<Categoria, string> = {
  singolo: "Prodotti singoli",
  pack: "Pack & Programmi",
};
type Vendita = {
  id: number;
  prodottoId: number;
  varianteId: number | null;
  variante: Variante | null;
  quantita: number;
  prezzoUnitario: number;
  data: string;
  canale?: string;
  prodotto: Prodotto;
};

// Per stats/totali: usa il prezzo della variante venduta se la vendita
// ne fa riferimento, altrimenti il prezzo del prodotto. Le fee restano
// quelle del prodotto (la variante non ne ha). I costi del prodotto
// si applicano sempre — riducono netto e margine reale.
function calcolaMarginiVendita(v: Vendita) {
  const prezzoBase = v.variante?.prezzoVendita ?? v.prodotto.prezzoVendita;
  return calcolaMargini({
    prezzoVendita: prezzoBase,
    feePerc: v.prodotto.feePerc,
    feeFissa: v.prodotto.feeFissa,
    costi: v.prodotto.costi,
  });
}

function margineColor(m: number) {
  if (m >= 65) return "#16a34a";
  if (m >= 50) return "#ca8a04";
  return "#dc2626";
}

function margineBadge(m: number) {
  if (m >= 65) return { bg: "#dcfce7", color: "#15803d" };
  if (m >= 50) return { bg: "#fef3c7", color: "#a16207" };
  return { bg: "#fee2e2", color: "#b91c1c" };
}

// Abbrevia stringhe lunghe per le label sull'asse Y dei grafici.
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// Palette categorica per le linee per-prodotto del grafico mensile.
// Ciclo se i prodotti sono > 12.
const LINE_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#3b82f6",
  "#a855f7",
  "#84cc16",
];

export default function ProdottiPage() {
  const [tab, setTab] = useState<"catalogo" | "vendite" | "stats">("catalogo");
  const [anno, setAnno] = useState(ANNO);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [vendite, setVendite] = useState<Vendita[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Per le varianti nel form: id negativo = locale (non ancora salvata).
  type FormVariante = {
    id: number; // > 0 esistente, < 0 nuovo locale
    nome: string;
    prezzoVendita: string;
  };
  type FormCosto = {
    id: number; // > 0 esistente, < 0 nuovo locale
    nome: string;
    tipo: "fisso" | "percentuale";
    valore: string;
  };
  const [form, setForm] = useState({
    nome: "",
    prezzoVendita: "",
    feePerc: "",
    feeFissa: "",
    tipoFee: "perc",
    categoria: "singolo" as Categoria,
    varianti: [] as FormVariante[],
    costi: [] as FormCosto[],
  });
  // Snapshot server al momento di apertura form (per diff su save)
  const [origVarianti, setOrigVarianti] = useState<Variante[]>([]);
  const [origCosti, setOrigCosti] = useState<Costo[]>([]);
  const [vForm, setVForm] = useState({
    prodottoId: "",
    varianteId: "",
    quantita: "1",
    data: new Date().toISOString().slice(0, 10),
    canale: "negozio",
  });
  const [showFhImport, setShowFhImport] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  const load = async () => {
    const [p, v] = await Promise.all([
      fetch("/api/prodotti").then((r) => r.json()),
      fetch(`/api/vendite?anno=${anno}`).then((r) => r.json()),
    ]);
    setProdotti(p);
    setVendite(v);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const ricavoTot = useMemo(
    () => vendite.reduce((s, v) => s + v.prezzoUnitario * v.quantita, 0),
    [vendite],
  );
  const nettoTot = useMemo(
    () =>
      vendite.reduce((s, v) => {
        // Usa il netto REALE (con costi) per il guadagno netto totale
        const { nettoReale } = calcolaMarginiVendita(v);
        return s + nettoReale * v.quantita;
      }, 0),
    [vendite],
  );
  const margineMedio = ricavoTot > 0 ? (nettoTot / ricavoTot) * 100 : 0;

  const topRicavo = useMemo(() => {
    const map = new Map<
      number,
      { nome: string; ricavo: number; netto: number }
    >();
    vendite.forEach((v) => {
      // Top prodotti per ricavo: usa netto REALE per consistenza coi KPI
      const { nettoReale } = calcolaMarginiVendita(v);
      const cur = map.get(v.prodottoId) ?? {
        nome: v.prodotto.nome,
        ricavo: 0,
        netto: 0,
      };
      map.set(v.prodottoId, {
        nome: cur.nome,
        ricavo: cur.ricavo + v.prezzoUnitario * v.quantita,
        netto: cur.netto + nettoReale * v.quantita,
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.ricavo - a.ricavo)
      .slice(0, 8);
  }, [vendite]);

  // Andamento mensile per-prodotto: pivot 12 righe (Gen..Dic) con una
  // colonna per ogni prodotto che ha almeno una vendita nell'anno.
  // I prodotti senza vendite vengono omessi (niente linee a 0 piatte).
  // L'ordine prodotti (e quindi colore stabile) è per ricavo annuo desc.
  const andamentoMensile = useMemo(() => {
    // Aggregato per (prodottoId, mese)
    const perId = new Map<
      number,
      { nome: string; totale: number; mensili: number[] }
    >();
    for (const v of vendite) {
      const idxMese = new Date(v.data).getMonth();
      if (idxMese < 0 || idxMese > 11) continue;
      const importo = v.prezzoUnitario * v.quantita;
      const cur = perId.get(v.prodottoId) ?? {
        nome: v.prodotto.nome,
        totale: 0,
        mensili: Array(12).fill(0) as number[],
      };
      cur.totale += importo;
      cur.mensili[idxMese] += importo;
      perId.set(v.prodottoId, cur);
    }
    // (Le aggregazioni sopra usano prezzoUnitario direttamente, che
    // contiene già il prezzo della variante venduta se applicabile.)
    // Ordina i prodotti per ricavo annuo desc (colore stabile per i top)
    const prodottiOrdinati = Array.from(perId.values()).sort(
      (a, b) => b.totale - a.totale,
    );
    const nomiSerie = prodottiOrdinati.map((p) => p.nome);

    // Costruisci dataset 12 righe con una colonna per prodotto
    const data = MESI.map((nome, idx) => {
      const row: Record<string, string | number> = {
        mese: nome.slice(0, 3),
      };
      for (const p of prodottiOrdinati) {
        row[p.nome] = Math.round(p.mensili[idx] * 100) / 100;
      }
      return row;
    });
    return { data, nomiSerie };
  }, [vendite]);

  // Visibilità linee per-prodotto (legenda cliccabile)
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const toggleHidden = (name: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const saveProdotto = async () => {
    const body = {
      nome: form.nome,
      prezzoVendita: Number(form.prezzoVendita),
      feePerc:
        form.tipoFee === "perc" && form.feePerc ? Number(form.feePerc) : null,
      feeFissa:
        form.tipoFee === "fissa" && form.feeFissa
          ? Number(form.feeFissa)
          : null,
      categoria: form.categoria,
    };
    // Identifica il prodottoId dopo create/patch per persistere le varianti
    let prodottoId = editId;
    if (editId) {
      await fetch(`/api/prodotti/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      const res = await fetch("/api/prodotti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const created = await res.json().catch(() => null);
      if (created?.id) prodottoId = created.id;
    }

    // Diff varianti vs server snapshot: POST per nuove, PATCH per modificate,
    // DELETE per quelle rimosse dalla lista locale.
    if (prodottoId) {
      const origMap = new Map(origVarianti.map((v) => [v.id, v]));
      const localIds = new Set(form.varianti.map((v) => v.id).filter((id) => id > 0));
      // DELETE: presenti nello snapshot ma non più nello state locale
      for (const orig of origVarianti) {
        if (!localIds.has(orig.id)) {
          await fetch(
            `/api/prodotti/${prodottoId}/varianti/${orig.id}`,
            { method: "DELETE" },
          );
        }
      }
      // POST/PATCH
      for (const v of form.varianti) {
        const nome = v.nome.trim();
        const prezzo = Number(v.prezzoVendita) || 0;
        if (!nome) continue;
        if (v.id < 0) {
          // nuova
          await fetch(`/api/prodotti/${prodottoId}/varianti`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, prezzoVendita: prezzo }),
          });
        } else {
          // esistente: PATCH solo se cambiato
          const orig = origMap.get(v.id);
          if (
            orig &&
            (orig.nome !== nome || Math.abs(orig.prezzoVendita - prezzo) > 0.001)
          ) {
            await fetch(`/api/prodotti/${prodottoId}/varianti/${v.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nome, prezzoVendita: prezzo }),
            });
          }
        }
      }

      // Diff costi vs server snapshot: stessa logica delle varianti
      const origCostiMap = new Map(origCosti.map((c) => [c.id, c]));
      const localCostiIds = new Set(
        form.costi.map((c) => c.id).filter((id) => id > 0),
      );
      for (const orig of origCosti) {
        if (!localCostiIds.has(orig.id)) {
          await fetch(
            `/api/prodotti/${prodottoId}/costi/${orig.id}`,
            { method: "DELETE" },
          );
        }
      }
      for (const c of form.costi) {
        const nome = c.nome.trim();
        const valore = Number(c.valore) || 0;
        if (!nome) continue;
        if (c.id < 0) {
          await fetch(`/api/prodotti/${prodottoId}/costi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, tipo: c.tipo, valore }),
          });
        } else {
          const orig = origCostiMap.get(c.id);
          if (
            orig &&
            (orig.nome !== nome ||
              orig.tipo !== c.tipo ||
              Math.abs(orig.valore - valore) > 0.001)
          ) {
            await fetch(`/api/prodotti/${prodottoId}/costi/${c.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nome, tipo: c.tipo, valore }),
            });
          }
        }
      }
    }

    setShowForm(false);
    setEditId(null);
    setForm({
      nome: "",
      prezzoVendita: "",
      feePerc: "",
      feeFissa: "",
      tipoFee: "perc",
      categoria: "singolo",
      varianti: [],
      costi: [],
    });
    setOrigVarianti([]);
    setOrigCosti([]);
    load();
  };

  const saveVendita = async () => {
    const p = prodotti.find((x) => x.id === Number(vForm.prodottoId));
    if (!p) return;
    // Se è stata scelta una variante, usa il suo prezzo invece di quello
    // base del prodotto. La variante è opzionale; se il prodotto non ha
    // varianti o l'utente non ne ha scelta, vForm.varianteId resta "".
    const variante = vForm.varianteId
      ? p.varianti.find((vv) => vv.id === Number(vForm.varianteId)) ?? null
      : null;
    const prezzoUnit = variante ? variante.prezzoVendita : p.prezzoVendita;
    await fetch("/api/vendite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prodottoId: Number(vForm.prodottoId),
        varianteId: variante ? variante.id : null,
        quantita: Number(vForm.quantita),
        prezzoUnitario: prezzoUnit,
        data: vForm.data,
        canale: vForm.canale,
      }),
    });
    setVForm({
      prodottoId: "",
      varianteId: "",
      quantita: "1",
      data: new Date().toISOString().slice(0, 10),
      canale: "negozio",
    });
    load();
  };

  const startEdit = (p: Prodotto) => {
    setEditId(p.id);
    setForm({
      nome: p.nome,
      prezzoVendita: String(p.prezzoVendita),
      feePerc: p.feePerc ? String(p.feePerc) : "",
      feeFissa: p.feeFissa ? String(p.feeFissa) : "",
      tipoFee: p.feePerc != null ? "perc" : "fissa",
      categoria: p.categoria,
      varianti: (p.varianti ?? []).map((v) => ({
        id: v.id,
        nome: v.nome,
        prezzoVendita: String(v.prezzoVendita),
      })),
      costi: (p.costi ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        valore: String(c.valore),
      })),
    });
    setOrigVarianti(p.varianti ?? []);
    setOrigCosti(p.costi ?? []);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({
      nome: "",
      prezzoVendita: "",
      feePerc: "",
      feeFissa: "",
      tipoFee: "perc",
      categoria: "singolo",
      varianti: [],
      costi: [],
    });
    setOrigVarianti([]);
    setOrigCosti([]);
  };

  const deleteProdotto = async (id: number) => {
    if (!confirm("Eliminare questo prodotto?")) return;
    await fetch(`/api/prodotti/${id}`, { method: "DELETE" });
    load();
  };

  const deleteVendita = async (id: number) => {
    if (!confirm("Eliminare questa vendita?")) return;
    await fetch(`/api/vendite/${id}`, { method: "DELETE" });
    load();
  };

  // DnD sensors: pointer (mouse/touch) + keyboard per accessibilità.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Liste filtrate per categoria; il drag-and-drop opera su queste e poi
  // ricalcoliamo l'ordine globale 1..N (prima i singoli, poi i pack).
  const prodottiSingoli = useMemo(
    () => prodotti.filter((p) => p.categoria === "singolo"),
    [prodotti],
  );
  const prodottiPack = useMemo(
    () => prodotti.filter((p) => p.categoria === "pack"),
    [prodotti],
  );

  // Trova la categoria target dal "over": può essere un id di prodotto
  // (Number) o l'id di un droppable area "category-singolo|pack".
  const findCategoria = (id: string | number): Categoria | null => {
    if (id === "category-singolo") return "singolo";
    if (id === "category-pack") return "pack";
    const idNum = Number(id);
    const p = prodotti.find((x) => x.id === idNum);
    return p?.categoria ?? null;
  };

  const persistOrdineAndCategoria = async (
    singoli: Prodotto[],
    pack: Prodotto[],
  ) => {
    const items: Array<{ id: number; ordine: number; categoria: Categoria }> = [
      ...singoli.map((p, i) => ({
        id: p.id,
        ordine: i + 1,
        categoria: "singolo" as const,
      })),
      ...pack.map((p, i) => ({
        id: p.id,
        ordine: singoli.length + i + 1,
        categoria: "pack" as const,
      })),
    ];
    // Optimistic local state con nuovi ordine + categoria
    setProdotti(
      items.map((it) => {
        const orig = prodotti.find((p) => p.id === it.id)!;
        return { ...orig, ordine: it.ordine, categoria: it.categoria };
      }),
    );
    try {
      await fetch("/api/prodotti/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
    } catch (e) {
      console.error("reorder failed", e);
      load();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    const srcCat = findCategoria(active.id);
    const dstCat = findCategoria(over.id);
    if (!srcCat || !dstCat) return;
    const activeId = Number(active.id);

    if (srcCat === dstCat) {
      // Intra-card reorder
      const list = srcCat === "singolo" ? prodottiSingoli : prodottiPack;
      const oldIndex = list.findIndex((p) => p.id === activeId);
      const newIndex = list.findIndex((p) => p.id === Number(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(list, oldIndex, newIndex);
      if (srcCat === "singolo") {
        await persistOrdineAndCategoria(reordered, prodottiPack);
      } else {
        await persistOrdineAndCategoria(prodottiSingoli, reordered);
      }
    } else {
      // Cross-card move
      const moving = prodotti.find((p) => p.id === activeId);
      if (!moving) return;
      const srcList = (srcCat === "singolo" ? prodottiSingoli : prodottiPack)
        .filter((p) => p.id !== activeId);
      const dstListOriginal =
        dstCat === "singolo" ? prodottiSingoli : prodottiPack;
      // Posizione di inserimento: se over è un prodotto, prima di quello;
      // se è l'area droppable della card (empty), in fondo.
      let insertAt = dstListOriginal.length;
      if (over.id !== `category-${dstCat}`) {
        const idx = dstListOriginal.findIndex((p) => p.id === Number(over.id));
        if (idx >= 0) insertAt = idx;
      }
      const dstList = [...dstListOriginal];
      dstList.splice(insertAt, 0, { ...moving, categoria: dstCat });

      if (srcCat === "singolo") {
        await persistOrdineAndCategoria(srcList, dstList);
      } else {
        await persistOrdineAndCategoria(dstList, srcList);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Prodotti & Margini
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {prodotti.length} prodotti · {vendite.length} vendite · anno {anno}
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
            onClick={() => setShowPdfMenu(true)}
            disabled={prodotti.length === 0}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Esporta catalogo, vendite o statistiche ${anno} in PDF`}
          >
            <FileDown className="w-4 h-4" style={{ color: "#ef4444" }} />{" "}
            Esporta PDF
          </button>
          <button
            onClick={() => setShowFhImport(true)}
            className="glass-btn-secondary flex items-center gap-2 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl"
            title="Importa il custom report CSV di FareHarbor"
          >
            <Upload className="w-4 h-4" style={{ color: "#0ea5e9" }} />
            Importa FareHarbor CSV
          </button>
          <button
            onClick={() => {
              setEditId(null);
              setForm({
                nome: "",
                prezzoVendita: "",
                feePerc: "",
                feeFissa: "",
                tipoFee: "perc",
                categoria: "singolo",
                varianti: [],
                costi: [],
              });
              setOrigVarianti([]);
              setOrigCosti([]);
              setShowForm(true);
            }}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Nuovo Prodotto
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardCount
          label="Prodotti attivi"
          value={prodotti.length}
        />
        <StatCard label={`Ricavo ${anno}`} value={ricavoTot} color="#0ea5e9" />
        <StatCard
          label={`Guadagno netto ${anno}`}
          value={nettoTot}
          color="#16a34a"
        />
        <StatCardPct
          label="Margine medio"
          value={margineMedio}
          color="#ca8a04"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["catalogo", "vendite", "stats"] as const).map((t) => {
          const active = tab === t;
          const labelMap = {
            catalogo: "Catalogo & Margini",
            vendite: "Vendite",
            stats: "Statistiche",
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px"
              style={
                active
                  ? { color: "#0ea5e9", borderColor: "#0ea5e9" }
                  : { color: "#64748b", borderColor: "transparent" }
              }
            >
              {labelMap[t]}
            </button>
          );
        })}
      </div>

      {/* TAB: Catalogo — due card (singoli / pack) impilate, DnD intra e cross */}
      {tab === "catalogo" && (
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-3">
            <CategoriaCard
              categoria="singolo"
              items={prodottiSingoli}
              onEdit={startEdit}
              onDelete={deleteProdotto}
              onReload={load}
            />
            <CategoriaCard
              categoria="pack"
              items={prodottiPack}
              onEdit={startEdit}
              onDelete={deleteProdotto}
              onReload={load}
            />
          </div>
        </DndContext>
      )}

      {/* TAB: Vendite */}
      {tab === "vendite" && (
        <>
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">
              Registra vendita
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Prodotto
                </label>
                <select
                  value={vForm.prodottoId}
                  onChange={(e) =>
                    setVForm((f) => ({
                      ...f,
                      prodottoId: e.target.value,
                      varianteId: "", // reset variante quando cambi prodotto
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                >
                  <option value="">Seleziona…</option>
                  {prodotti.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                {/* Picker variante: appare solo se il prodotto scelto ne ha */}
                {(() => {
                  const p = prodotti.find(
                    (x) => x.id === Number(vForm.prodottoId),
                  );
                  if (!p || p.varianti.length === 0) return null;
                  return (
                    <select
                      value={vForm.varianteId}
                      onChange={(e) =>
                        setVForm((f) => ({
                          ...f,
                          varianteId: e.target.value,
                        }))
                      }
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                    >
                      <option value="">— Variante (opzionale) —</option>
                      {p.varianti.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome} · {fmt(v.prezzoVendita)}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Quantità
                </label>
                <input
                  type="number"
                  min="1"
                  value={vForm.quantita}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, quantita: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={vForm.data}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, data: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Canale
                </label>
                <select
                  value={vForm.canale}
                  onChange={(e) =>
                    setVForm((f) => ({ ...f, canale: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white capitalize"
                >
                  {CANALI.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={saveVendita}
                disabled={!vForm.prodottoId}
                className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Aggiungi
              </button>
            </div>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      "Data",
                      "Prodotto",
                      "Qt.",
                      "Prezzo unit.",
                      "Totale",
                      "Canale",
                      "",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${i === 2 || i === 3 || i === 4 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="zebra">
                  {vendite.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center text-gray-400 py-12 text-sm"
                      >
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        Nessuna vendita registrata per {anno}.
                      </td>
                    </tr>
                  )}
                  {vendite.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(v.data).toLocaleDateString("it-IT")}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {v.prodotto.nome}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {v.quantita}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {fmt(v.prezzoUnitario)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                        {fmt(v.prezzoUnitario * v.quantita)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                        {v.canale ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => deleteVendita(v.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB: Statistiche */}
      {tab === "stats" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                Top prodotti per ricavo
              </h3>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={topRicavo.map((r) => ({
                      ...r,
                      nome: truncate(r.nome, 20),
                    }))}
                    layout="vertical"
                    margin={{ left: 12, right: 24 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `€${v}`}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                      dataKey="nome"
                      type="category"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      width={140}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{
                        background: "rgba(255,255,255,0.95)",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="ricavo" radius={[0, 4, 4, 0]}>
                      {topRicavo.map((_, i) => (
                        <Cell key={i} fill="#0ea5e9" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                Margine netto reale per prodotto
                <span className="ml-2 text-[10px] font-normal text-gray-500">
                  dopo IVA, fee e costi · ordinati per margine
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[...prodotti]
                  .map((p) => ({ p, m: calcolaMargini(p) }))
                  .sort((a, b) => b.m.margineReale - a.m.margineReale)
                  .map(({ p, m }) => {
                    const hasCosti = m.costiTotali > 0;
                    const prezzoNotSet = p.prezzoVendita <= 0;
                    const color = margineColor(m.margineReale);
                    // Barra di progresso 0..100, clampata per valori negativi
                    // o > 100%.
                    const progressPct = Math.max(
                      0,
                      Math.min(100, m.margineReale),
                    );
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors"
                      >
                        <p
                          className="text-xs font-semibold text-gray-800 truncate mb-1.5"
                          title={p.nome}
                        >
                          {p.nome}
                        </p>
                        {prezzoNotSet ? (
                          <>
                            <p className="text-xs text-gray-400 italic">
                              — prezzo non impostato
                            </p>
                            {p.varianti.length > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                {p.varianti.length}{" "}
                                {p.varianti.length === 1
                                  ? "variante"
                                  : "varianti"}{" "}
                                · vedi catalogo
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {hasCosti && (
                              <p className="text-[10px] text-gray-400 leading-none mb-0.5">
                                lordo {m.margine.toFixed(1)}%
                              </p>
                            )}
                            <p
                              className="text-2xl font-bold leading-none"
                              style={{ color }}
                            >
                              {m.margineReale.toFixed(1)}%
                            </p>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1.5">
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${progressPct}%`,
                                  background: color,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500 pt-1.5">
                              <span>
                                <span className="text-gray-400">Prezzo </span>
                                {fmt(p.prezzoVendita)}
                              </span>
                              <span>
                                <span className="text-gray-400">Netto </span>
                                {fmt(m.nettoReale)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Andamento mensile per-prodotto: una linea per prodotto.
              Legenda cliccabile per nascondere/mostrare singole serie. */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-bold text-gray-900">
                Andamento mensile per prodotto {anno}
              </h3>
              <span className="text-[10px] text-gray-400">
                {andamentoMensile.nomiSerie.length} prodotti · clicca sulla
                legenda per filtrare
              </span>
            </div>
            {andamentoMensile.nomiSerie.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                Nessuna vendita registrata per {anno}.
              </div>
            ) : (
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={andamentoMensile.data}
                    margin={{ left: 12, right: 24, top: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="mese"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(v: number) => `€${v}`}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{
                        background: "rgba(255,255,255,0.95)",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                      }}
                      itemStyle={{ fontSize: 11 }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      onClick={(e) => {
                        const id = String(
                          (e as { dataKey?: string | number }).dataKey ?? "",
                        );
                        if (id) toggleHidden(id);
                      }}
                    />
                    {andamentoMensile.nomiSerie.map((nome, i) => (
                      <Line
                        key={nome}
                        type="monotone"
                        dataKey={nome}
                        name={nome}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        hide={hiddenLines.has(nome)}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal nuovo/modifica prodotto */}
      {showForm && (
        <ProdottoFormModal
          editId={editId}
          form={form}
          setForm={setForm}
          onSave={saveProdotto}
          onClose={closeForm}
        />
      )}

      {/* Modal importa CSV FareHarbor */}
      {showFhImport && (
        <FareHarborImportModal
          prodotti={prodotti}
          onClose={() => setShowFhImport(false)}
          onImported={() => {
            setShowFhImport(false);
            load();
          }}
        />
      )}

      {/* Modal scelta export PDF */}
      {showPdfMenu && (
        <PdfExportModal
          onClose={() => setShowPdfMenu(false)}
          onPick={(sections) => {
            setShowPdfMenu(false);
            exportProdottiPDF(
              prodotti.map((p) => ({
                nome: p.nome,
                prezzoVendita: p.prezzoVendita,
                feePerc: p.feePerc,
                feeFissa: p.feeFissa,
              })),
              vendite.map((v) => ({
                data: v.data,
                nomeProdotto: v.prodotto.nome,
                quantita: v.quantita,
                prezzoUnitario: v.prezzoUnitario,
                canale: v.canale ?? null,
              })),
              {
                ricavoTotale: ricavoTot,
                guadagnoNetto: nettoTot,
                margineMedio: margineMedio,
              },
              anno,
              topRicavo,
              sections,
            );
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function StatCard({
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
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {fmt(value)}
      </p>
    </div>
  );
}

function StatCardCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
    </div>
  );
}

function StatCardPct({
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
        {value.toFixed(1)}%
      </p>
    </div>
  );
}

// ─── Card categoria (titolo + tabella sortable + droppable area) ──────

function CategoriaCard({
  categoria,
  items,
  onEdit,
  onDelete,
  onReload,
}: {
  categoria: Categoria;
  items: Prodotto[];
  onEdit: (p: Prodotto) => void;
  onDelete: (id: number) => void;
  onReload: () => void;
}) {
  // L'intero card-body è droppable così il drop su area vuota o "in fondo"
  // viene catturato dal DndContext padre.
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${categoria}`,
  });
  // Varianti e costi sono entrambi sempre visibili sotto il prodotto padre
  // (niente badge toggle). Servono solo all'utente come hint contestuali.
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-900">
          {CATEGORIA_LABEL[categoria]}
          <span className="ml-2 text-xs font-medium text-gray-500">
            ({items.length})
          </span>
        </h3>
      </div>
      <SortableContext
        items={items.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="overflow-x-auto transition-colors"
          style={{ background: isOver ? "#f0f9ff" : undefined }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {["", "Prodotto", "Prezzo", "Fee", "Netto", "Margine", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-3 py-2 ${i === 1 || i === 6 ? "text-left" : i === 0 ? "" : "text-right"}`}
                      style={i === 0 ? { width: "32px" } : undefined}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="zebra">
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nessun prodotto in questa categoria
                    <p className="text-[10px] mt-1 opacity-60">
                      Trascina qui un prodotto dall&apos;altra card
                    </p>
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <React.Fragment key={p.id}>
                  <CompactSortableRow
                    prodotto={p}
                    onEdit={() => onEdit(p)}
                    onDelete={() => onDelete(p.id)}
                  />
                  {/* Varianti sempre visibili sotto il prodotto padre.
                      L'aggiunta di nuove varianti avviene solo tramite il
                      form di modifica prodotto (icona matita). */}
                  {p.varianti.length > 0 &&
                    p.varianti.map((v) => (
                      <VarianteInlineRow
                        key={v.id}
                        variante={v}
                        prodotto={p}
                        onReload={onReload}
                      />
                    ))}
                  {/* Costi sempre visibili sotto, con summary margine reale */}
                  {p.costi.length > 0 && (
                    <>
                      {p.costi.map((c) => (
                        <CostoInlineRow
                          key={c.id}
                          costo={c}
                          prodotto={p}
                          onReload={onReload}
                        />
                      ))}
                      <CostiSummaryRow prodotto={p} />
                      <CostoAddRow prodotto={p} onReload={onReload} />
                    </>
                  )}
                  {/* Se prodotto non ha costi né varianti: niente extra */}
                  {p.varianti.length === 0 && p.costi.length === 0 && null}
                  {/* Se ha varianti ma NON costi: aggiungi una riga per
                      offrire l'add di un primo costo? Skip, l'utente può
                      farlo dal modal Modifica. Stesso vale per varianti. */}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </SortableContext>
    </div>
  );
}

// Riga compatta per le card singole (meno colonne, più stretta).
// Se il prodotto ha varianti i valori prezzo/netto/margine vengono
// mostrati come "—" perché sono le varianti ad avere i prezzi reali.
function CompactSortableRow({
  prodotto,
  onEdit,
  onDelete,
}: {
  prodotto: Prodotto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const hasVarianti = prodotto.varianti.length > 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prodotto.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: isDragging ? "#f0f9ff" : undefined,
  };

  const margini = calcolaMargini(prodotto);
  const { netto, margine, costiTotali, nettoReale, margineReale } = margini;
  const hasCosti = costiTotali > 0;
  const badgeReale = margineBadge(margineReale);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
    >
      <td className="px-2 py-2 w-8">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600 p-1 rounded touch-none"
          title="Trascina per riordinare o spostare di categoria"
          aria-label="Trascina"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-3 py-2 text-sm font-medium text-gray-900">
        <div className="flex items-center gap-2 flex-wrap">
          <span>{prodotto.nome}</span>
          {hasVarianti && (
            <span className="text-[10px] text-gray-400 font-normal">
              {prodotto.varianti.length}{" "}
              {prodotto.varianti.length === 1 ? "variante" : "varianti"}
            </span>
          )}
          {prodotto.costi.length > 0 && (
            <span className="text-[10px] text-amber-600 font-normal">
              {prodotto.costi.length}{" "}
              {prodotto.costi.length === 1 ? "costo" : "costi"}
            </span>
          )}
        </div>
      </td>
      {hasVarianti ? (
        // Prezzo/fee/netto/margine sono sulle righe variante sottostanti
        <>
          <td className="px-3 py-2 text-sm text-right text-gray-300">—</td>
          <td className="px-3 py-2 text-sm text-right text-gray-300">—</td>
          <td className="px-3 py-2 text-sm text-right text-gray-300">—</td>
          <td className="px-3 py-2 text-right text-gray-300 text-sm">—</td>
        </>
      ) : (
        <>
          <td className="px-3 py-2 text-sm text-right text-gray-900">
            {fmt(prodotto.prezzoVendita)}
          </td>
          <td className="px-3 py-2 text-sm text-right text-gray-500">
            {prodotto.feePerc != null
              ? `${prodotto.feePerc}%`
              : prodotto.feeFissa != null
                ? fmt(prodotto.feeFissa)
                : "—"}
          </td>
          <td className="px-3 py-2 text-right">
            {hasCosti ? (
              <div className="flex flex-col items-end leading-tight">
                <span
                  className="text-sm font-bold"
                  style={{ color: margineColor(margineReale) }}
                  title="Netto reale (dopo costi)"
                >
                  {fmt(nettoReale)}
                </span>
                <span
                  className="text-[10px] text-gray-400 line-through"
                  title="Netto lordo (senza costi)"
                >
                  {fmt(netto)}
                </span>
              </div>
            ) : (
              <span
                className="text-sm font-bold"
                style={{ color: margineColor(margine) }}
              >
                {fmt(netto)}
              </span>
            )}
          </td>
          <td className="px-3 py-2 text-right">
            {hasCosti ? (
              <div className="flex flex-col items-end gap-0.5 leading-tight">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold"
                  style={{
                    background: badgeReale.bg,
                    color: badgeReale.color,
                  }}
                  title="Margine reale (con costi)"
                >
                  {margineReale.toFixed(1)}%
                </span>
                <span
                  className="text-[9px] text-gray-400"
                  title="Margine lordo (senza costi)"
                >
                  lordo {margine.toFixed(1)}%
                </span>
              </div>
            ) : (
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  background: margineBadge(margine).bg,
                  color: margineBadge(margine).color,
                }}
              >
                {margine.toFixed(1)}%
              </span>
            )}
          </td>
        </>
      )}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
            title="Modifica"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Variant inline rows (sempre visibili sotto il prodotto padre) ────

// Larghezza fittizia delle colonne (deve combaciare con CompactSortableRow:
// drag-handle 32px, Prodotto, Prezzo, Fee, Netto, Margine, actions)
const VARIANTE_BORDER = "3px solid #0ea5e9";

function VarianteInlineRow({
  variante,
  prodotto,
  onReload,
}: {
  variante: Variante;
  prodotto: Prodotto;
  onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Stato per la modalità "edit" del prezzo: mostra fmt() quando blurred,
  // numero raw quando in focus per consentire l'editing senza il simbolo €.
  const [prezzoEditing, setPrezzoEditing] = useState(false);
  const [prezzoDraft, setPrezzoDraft] = useState("");
  // Parser tollerante: accetta "60", "60.00", "60,00", "60 €", "€ 60"
  const parsePrezzo = (s: string): number => {
    const t = s.replace(/[€\s]/g, "").trim();
    if (!t) return 0;
    if (t.includes(",")) {
      return parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(t) || 0;
  };
  const update = async (
    field: "nome" | "prezzoVendita",
    value: string,
    original: string,
  ) => {
    if (value.trim() === original.trim()) return;
    setBusy(true);
    try {
      await fetch(
        `/api/prodotti/${prodotto.id}/varianti/${variante.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        },
      );
      onReload();
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!confirm("Eliminare questa variante?")) return;
    setBusy(true);
    try {
      await fetch(
        `/api/prodotti/${prodotto.id}/varianti/${variante.id}`,
        { method: "DELETE" },
      );
      onReload();
    } finally {
      setBusy(false);
    }
  };
  const margini = calcolaMargini({
    prezzoVendita: variante.prezzoVendita,
    feePerc: prodotto.feePerc,
    feeFissa: prodotto.feeFissa,
    costi: prodotto.costi,
  });
  const hasCosti = margini.costiTotali > 0;
  const badgeReale = margineBadge(margini.margineReale);

  return (
    <tr
      style={{ background: "#f8fbff", opacity: busy ? 0.6 : 1 }}
      className="border-b border-gray-50"
    >
      <td
        className="px-2 py-1.5 w-8"
        style={{ borderLeft: VARIANTE_BORDER }}
      />
      <td className="px-3 py-1.5 text-sm pl-6 text-gray-700">
        <span className="text-gray-400 mr-1">↳</span>
        <input
          type="text"
          defaultValue={variante.nome}
          onBlur={(e) => update("nome", e.target.value, variante.nome)}
          className="bg-transparent border-b border-transparent hover:border-gray-200 focus:border-sky-300 focus:outline-none px-1 py-0.5 text-sm font-medium text-gray-800 w-full max-w-[260px]"
        />
      </td>
      <td className="px-3 py-1.5 text-sm text-right">
        <input
          type="text"
          inputMode="decimal"
          value={prezzoEditing ? prezzoDraft : fmt(variante.prezzoVendita)}
          onFocus={(e) => {
            setPrezzoEditing(true);
            setPrezzoDraft(String(variante.prezzoVendita));
            setTimeout(() => e.target.select(), 0);
          }}
          onChange={(e) => setPrezzoDraft(e.target.value)}
          onBlur={() => {
            setPrezzoEditing(false);
            const parsed = parsePrezzo(prezzoDraft);
            update(
              "prezzoVendita",
              String(parsed),
              String(variante.prezzoVendita),
            );
          }}
          className="bg-transparent border-b border-transparent hover:border-gray-200 focus:border-sky-300 focus:outline-none px-1 py-0.5 text-sm text-right text-gray-900 w-24"
        />
      </td>
      <td className="px-3 py-1.5 text-sm text-right text-gray-400">
        {prodotto.feePerc != null
          ? `${prodotto.feePerc}%`
          : prodotto.feeFissa != null
            ? fmt(prodotto.feeFissa)
            : "—"}
      </td>
      <td className="px-3 py-1.5 text-right">
        {hasCosti ? (
          <div className="flex flex-col items-end leading-tight">
            <span
              className="text-sm font-bold"
              style={{ color: margineColor(margini.margineReale) }}
            >
              {fmt(margini.nettoReale)}
            </span>
            <span className="text-[10px] text-gray-400 line-through">
              {fmt(margini.netto)}
            </span>
          </div>
        ) : (
          <span
            className="text-sm font-bold"
            style={{ color: margineColor(margini.margine) }}
          >
            {fmt(margini.netto)}
          </span>
        )}
      </td>
      <td className="px-3 py-1.5 text-right">
        {hasCosti ? (
          <div className="flex flex-col items-end gap-0.5 leading-tight">
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: badgeReale.bg, color: badgeReale.color }}
            >
              {margini.margineReale.toFixed(1)}%
            </span>
            <span className="text-[9px] text-gray-400">
              lordo {margini.margine.toFixed(1)}%
            </span>
          </div>
        ) : (
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{
              background: margineBadge(margini.margine).bg,
              color: margineBadge(margini.margine).color,
            }}
          >
            {margini.margine.toFixed(1)}%
          </span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end">
          <button
            onClick={del}
            disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
            title="Elimina variante"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Costi inline rows (sempre visibili sotto il prodotto padre) ──────

// Bordo sinistro ambra per distinguere visivamente i costi dalle varianti
// (che usano sky). Le righe costi hanno background ambra tenue.
const COSTO_BORDER = "3px solid #d97706";

function CostoInlineRow({
  costo,
  prodotto,
  onReload,
}: {
  costo: Costo;
  prodotto: Prodotto;
  onReload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const update = async (
    field: "nome" | "tipo" | "valore",
    value: string,
    original: string,
  ) => {
    if (value.trim() === original.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/prodotti/${prodotto.id}/costi/${costo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      onReload();
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!confirm("Eliminare questo costo?")) return;
    setBusy(true);
    try {
      await fetch(`/api/prodotti/${prodotto.id}/costi/${costo.id}`, {
        method: "DELETE",
      });
      onReload();
    } finally {
      setBusy(false);
    }
  };
  // Per il calcolo "impatto €" usiamo il prezzoVendita del prodotto se
  // > 0, altrimenti la media delle varianti (così su prodotti con varianti
  // l'impatto è comunque indicativo).
  const baseLordo =
    prodotto.prezzoVendita > 0
      ? prodotto.prezzoVendita
      : prodotto.varianti.length > 0
        ? prodotto.varianti.reduce((s, v) => s + v.prezzoVendita, 0) /
          prodotto.varianti.length
        : 0;
  const impatto =
    costo.tipo === "fisso" ? costo.valore : (costo.valore / 100) * baseLordo;

  return (
    <tr
      style={{ background: "#fffbeb", opacity: busy ? 0.6 : 1 }}
      className="border-b border-gray-50"
    >
      <td
        className="px-2 py-1.5 w-8"
        style={{ borderLeft: COSTO_BORDER }}
      />
      <td className="px-3 py-1.5 text-sm pl-6 text-gray-700">
        <span className="text-amber-500 mr-1">⊖</span>
        <input
          type="text"
          defaultValue={costo.nome}
          onBlur={(e) => update("nome", e.target.value, costo.nome)}
          className="bg-transparent border-b border-transparent hover:border-gray-200 focus:border-amber-400 focus:outline-none px-1 py-0.5 text-sm font-medium text-gray-800 w-full max-w-[260px]"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <select
          defaultValue={costo.tipo}
          onChange={(e) => update("tipo", e.target.value, costo.tipo)}
          className="bg-transparent border-b border-transparent hover:border-gray-200 focus:border-amber-400 focus:outline-none px-1 py-0.5 text-xs text-gray-700"
        >
          <option value="fisso">Fisso €</option>
          <option value="percentuale">% del prezzo</option>
        </select>
      </td>
      <td className="px-3 py-1.5 text-sm text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            defaultValue={costo.valore}
            onBlur={(e) =>
              update("valore", e.target.value, String(costo.valore))
            }
            className="bg-transparent border-b border-transparent hover:border-gray-200 focus:border-amber-400 focus:outline-none px-1 py-0.5 text-sm text-right text-gray-900 w-16"
          />
          <span className="text-[10px] text-gray-400">
            {costo.tipo === "fisso" ? "€" : "%"}
          </span>
        </div>
      </td>
      <td className="px-3 py-1.5 text-right text-sm font-bold text-amber-700">
        {fmt(impatto)}
      </td>
      <td className="px-3 py-1.5 text-right">
        <span className="text-[10px] text-amber-600">impatto</span>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end">
          <button
            onClick={del}
            disabled={busy}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
            title="Elimina costo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Riepilogo sotto i costi: mostra "Margine reale" del prodotto dopo
// aver sottratto tutti i costi. Solo se il prezzoVendita > 0 (altrimenti
// per prodotti con varianti il margine reale è già su ogni riga variante).
function CostiSummaryRow({ prodotto }: { prodotto: Prodotto }) {
  if (prodotto.prezzoVendita <= 0) {
    // Niente margine summary qui: i prodotti con prezzo base 0 (di norma
    // quelli con varianti) hanno il margine reale sulle righe variante.
    return null;
  }
  const margini = calcolaMargini(prodotto);
  const badge = margineBadge(margini.margineReale);
  return (
    <tr style={{ background: "#fef3c7" }} className="border-b border-amber-200">
      <td
        className="px-2 py-1.5 w-8"
        style={{ borderLeft: COSTO_BORDER }}
      />
      <td
        colSpan={3}
        className="px-3 py-1.5 text-xs font-semibold text-amber-800"
      >
        Margine reale (dopo IVA, fee e {prodotto.costi.length}{" "}
        {prodotto.costi.length === 1 ? "costo" : "costi"})
      </td>
      <td className="px-3 py-1.5 text-right">
        <span
          className="text-sm font-bold"
          style={{ color: margineColor(margini.margineReale) }}
        >
          {fmt(margini.nettoReale)}
        </span>
      </td>
      <td className="px-3 py-1.5 text-right">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: badge.bg, color: badge.color }}
        >
          {margini.margineReale.toFixed(1)}%
        </span>
      </td>
      <td />
    </tr>
  );
}

// Riga inline per aggiungere un costo al volo
function CostoAddRow({
  prodotto,
  onReload,
}: {
  prodotto: Prodotto;
  onReload: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"fisso" | "percentuale">("fisso");
  const [valore, setValore] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const n = nome.trim();
    const v = parseFloat(valore) || 0;
    if (!n) return;
    setBusy(true);
    try {
      await fetch(`/api/prodotti/${prodotto.id}/costi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: n, tipo, valore: v }),
      });
      setNome("");
      setTipo("fisso");
      setValore("");
      onReload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <tr
      style={{ background: "#fefcf5" }}
      className="border-b border-gray-100"
    >
      <td
        className="px-2 py-1.5 w-8"
        style={{ borderLeft: COSTO_BORDER }}
      />
      <td className="px-3 py-1.5 pl-6">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nuovo costo (es. Commissione FH)…"
          className="bg-transparent border-b border-dashed border-amber-200 hover:border-amber-300 focus:border-amber-400 focus:outline-none px-1 py-0.5 text-sm text-gray-700 w-full max-w-[260px]"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "fisso" | "percentuale")}
          className="bg-transparent border-b border-dashed border-amber-200 focus:border-amber-400 focus:outline-none px-1 py-0.5 text-xs text-gray-700"
        >
          <option value="fisso">Fisso €</option>
          <option value="percentuale">% del prezzo</option>
        </select>
      </td>
      <td className="px-3 py-1.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            placeholder={tipo === "fisso" ? "€" : "%"}
            className="bg-transparent border-b border-dashed border-amber-200 hover:border-amber-300 focus:border-amber-400 focus:outline-none px-1 py-0.5 text-sm text-right text-gray-700 w-16"
          />
          <span className="text-[10px] text-gray-400">
            {tipo === "fisso" ? "€" : "%"}
          </span>
        </div>
      </td>
      <td colSpan={2} />
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={add}
            disabled={!nome.trim() || busy}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded disabled:opacity-30"
            title="Aggiungi costo"
          >
            <Plus className="w-3 h-3" />
            Aggiungi
          </button>
        </div>
      </td>
    </tr>
  );
}


// ─── Modal Prodotto ───────────────────────────────────────────────────

function ProdottoFormModal({
  editId,
  form,
  setForm,
  onSave,
  onClose,
}: {
  editId: number | null;
  form: {
    nome: string;
    prezzoVendita: string;
    feePerc: string;
    feeFissa: string;
    tipoFee: string;
    categoria: Categoria;
    varianti: { id: number; nome: string; prezzoVendita: string }[];
    costi: {
      id: number;
      nome: string;
      tipo: "fisso" | "percentuale";
      valore: string;
    }[];
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      nome: string;
      prezzoVendita: string;
      feePerc: string;
      feeFissa: string;
      tipoFee: string;
      categoria: Categoria;
      varianti: { id: number; nome: string; prezzoVendita: string }[];
      costi: {
        id: number;
        nome: string;
        tipo: "fisso" | "percentuale";
        valore: string;
      }[];
    }>
  >;
  onSave: () => void;
  onClose: () => void;
}) {
  // Generatore di ID negativi temporanei per varianti/costi nuovi (locali).
  const nextTempIdVar = () => {
    const min = form.varianti.reduce((m, v) => (v.id < m ? v.id : m), 0);
    return min - 1;
  };
  const nextTempIdCos = () => {
    const min = form.costi.reduce((m, c) => (c.id < m ? c.id : m), 0);
    return min - 1;
  };
  const addVariante = () =>
    setForm((f) => ({
      ...f,
      varianti: [
        ...f.varianti,
        { id: nextTempIdVar(), nome: "", prezzoVendita: "" },
      ],
    }));
  const updateVariante = (
    id: number,
    patch: Partial<{ nome: string; prezzoVendita: string }>,
  ) =>
    setForm((f) => ({
      ...f,
      varianti: f.varianti.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  const removeVariante = (id: number) =>
    setForm((f) => ({
      ...f,
      varianti: f.varianti.filter((v) => v.id !== id),
    }));
  const addCosto = () =>
    setForm((f) => ({
      ...f,
      costi: [
        ...f.costi,
        { id: nextTempIdCos(), nome: "", tipo: "fisso", valore: "" },
      ],
    }));
  const updateCosto = (
    id: number,
    patch: Partial<{
      nome: string;
      tipo: "fisso" | "percentuale";
      valore: string;
    }>,
  ) =>
    setForm((f) => ({
      ...f,
      costi: f.costi.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  const removeCosto = (id: number) =>
    setForm((f) => ({
      ...f,
      costi: f.costi.filter((c) => c.id !== id),
    }));
  const previewArgs = {
    prezzoVendita: Number(form.prezzoVendita) || 0,
    feePerc:
      form.tipoFee === "perc" && form.feePerc ? Number(form.feePerc) : null,
    feeFissa:
      form.tipoFee === "fissa" && form.feeFissa
        ? Number(form.feeFissa)
        : null,
    costi: form.costi
      .filter((c) => c.nome.trim() !== "")
      .map((c) => ({
        tipo: c.tipo,
        valore: Number(c.valore) || 0,
      })),
  };
  const preview =
    previewArgs.prezzoVendita > 0 ? calcolaMargini(previewArgs) : null;

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
            {editId ? "Modifica Prodotto" : "Nuovo Prodotto"}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, nome: e.target.value }))
              }
              placeholder="Es. Lezione SUP individuale"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Prezzo vendita (€ IVA incl.) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.prezzoVendita}
              onChange={(e) =>
                setForm((f) => ({ ...f, prezzoVendita: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Categoria
            </label>
            <select
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  categoria: e.target.value as Categoria,
                }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="singolo">Singolo</option>
              <option value="pack">Pack</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Tipo fee
            </label>
            <select
              value={form.tipoFee}
              onChange={(e) =>
                setForm((f) => ({ ...f, tipoFee: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="perc">Percentuale %</option>
              <option value="fissa">Importo fisso €</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">
              {form.tipoFee === "perc" ? "Fee %" : "Fee €"}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.tipoFee === "perc" ? form.feePerc : form.feeFissa}
              onChange={(e) =>
                form.tipoFee === "perc"
                  ? setForm((f) => ({ ...f, feePerc: e.target.value }))
                  : setForm((f) => ({ ...f, feeFissa: e.target.value }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>

        {/* Sezione Varianti */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              Varianti
              <span className="text-[10px] text-gray-500 ml-2 font-normal">
                (opzionale — prezzi alternativi per lo stesso prodotto)
              </span>
            </p>
            <button
              type="button"
              onClick={addVariante}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Aggiungi variante
            </button>
          </div>
          {form.varianti.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Nessuna variante. Clicca &quot;Aggiungi variante&quot; per
              inserire prezzi alternativi (es. taglie, durate).
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_120px_32px] gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1">
                <span>Nome</span>
                <span className="text-right">Prezzo (€)</span>
                <span />
              </div>
              {form.varianti.map((v) => (
                <div
                  key={v.id}
                  className="grid grid-cols-[1fr_120px_32px] gap-2 items-center"
                >
                  <input
                    type="text"
                    value={v.nome}
                    onChange={(e) =>
                      updateVariante(v.id, { nome: e.target.value })
                    }
                    placeholder="es. SUP Pack - 4 Sessions"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={v.prezzoVendita}
                    onChange={(e) =>
                      updateVariante(v.id, { prezzoVendita: e.target.value })
                    }
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariante(v.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Rimuovi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sezione Costi */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              Costi
              <span className="text-[10px] text-gray-500 ml-2 font-normal">
                (opzionale — costi che riducono il margine reale)
              </span>
            </p>
            <button
              type="button"
              onClick={addCosto}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Aggiungi costo
            </button>
          </div>
          {form.costi.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Nessun costo. Clicca &quot;Aggiungi costo&quot; per inserire
              incidenze esterne (es. commissioni, materiale di consumo).
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_130px_100px_32px] gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1">
                <span>Nome</span>
                <span>Tipo</span>
                <span className="text-right">Valore</span>
                <span />
              </div>
              {form.costi.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_130px_100px_32px] gap-2 items-center"
                >
                  <input
                    type="text"
                    value={c.nome}
                    onChange={(e) =>
                      updateCosto(c.id, { nome: e.target.value })
                    }
                    placeholder="es. Commissione FareHarbor"
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <select
                    value={c.tipo}
                    onChange={(e) =>
                      updateCosto(c.id, {
                        tipo: e.target.value as "fisso" | "percentuale",
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="fisso">Fisso €</option>
                    <option value="percentuale">Percentuale %</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={c.valore}
                    onChange={(e) =>
                      updateCosto(c.id, { valore: e.target.value })
                    }
                    placeholder={c.tipo === "fisso" ? "€" : "%"}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeCosto(c.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Rimuovi"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {preview && (
          <div className="rounded-xl p-3 bg-gray-50 border border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-2">
              Anteprima Margini
            </p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-gray-500">IVA 21%</p>
                <p className="text-sm font-bold text-gray-700">
                  {fmt(preview.iva)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Fee</p>
                <p className="text-sm font-bold text-gray-700">
                  {fmt(preview.fee)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Netto lordo</p>
                <p className="text-sm font-bold text-gray-500">
                  {fmt(preview.netto)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Margine lordo</p>
                <p
                  className="text-sm font-bold text-gray-500"
                  title="Senza costi"
                >
                  {preview.margine.toFixed(1)}%
                </p>
              </div>
            </div>
            {preview.costiTotali > 0 && (
              <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200">
                <div>
                  <p className="text-[10px] text-gray-500">Totale costi</p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: "#dc2626" }}
                  >
                    − {fmt(preview.costiTotali)}
                  </p>
                </div>
                <div />
                <div>
                  <p className="text-[10px] text-gray-500">Netto reale</p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: margineColor(preview.margineReale) }}
                  >
                    {fmt(preview.nettoReale)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Margine reale</p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: margineColor(preview.margineReale) }}
                  >
                    {preview.margineReale.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={onSave}
            disabled={!form.nome.trim() || !form.prezzoVendita}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editId ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FareHarbor "Custom bookings report" Import Modal ─────────────────

const MESI_LABEL = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

// Parsa "€50.00" / "€1,234.56" / "€50,00" → 50.00
function parseGross(raw: string): number {
  if (!raw) return 0;
  let s = String(raw).replace(/[€\s]/g, "").trim();
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function lastDayOfMonth(anno: number, mese: number): string {
  // mese 1-12; new Date(anno, mese, 0) = ultimo giorno del mese precedente +1
  // ovvero ultimo giorno di "mese". Output ISO YYYY-MM-DD.
  const d = new Date(anno, mese, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface FHBookingParsedRow {
  nomeProdotto: string;
  bookings: number; // # of Bookings
  pax: number; // # of Pax
  totalPaid: number; // Total Paid
  matchedProdottoId: number | null;
  // Esistenza vendita FH "import CSV mese/anno" per stesso prodotto
  duplicateExistingId: number | null;
}

interface ExistingFhVendita {
  id: number;
  prodottoId: number;
  note: string | null;
}

function FareHarborImportModal({
  prodotti,
  onClose,
  onImported,
}: {
  prodotti: Prodotto[];
  onClose: () => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = new Date();
  const [meseSel, setMeseSel] = useState<number>(today.getMonth() + 1);
  const [annoSel, setAnnoSel] = useState<number>(today.getFullYear());
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [parsed, setParsed] = useState<{
    valide: FHBookingParsedRow[];
    duplicate: FHBookingParsedRow[];
    nonTrovati: FHBookingParsedRow[];
    errori: string[];
  } | null>(null);
  const [done, setDone] = useState<{
    created: number;
    overwritten: number;
    errors: string[];
  } | null>(null);

  const prodottoByName = useMemo(() => {
    const m = new Map<string, Prodotto>();
    for (const p of prodotti) m.set(p.nome.trim().toLowerCase(), p);
    return m;
  }, [prodotti]);

  // Tag univoco usato nel campo `note` per identificare le righe di import
  // per uno stesso (mese, anno). Esempio: "import CSV 5/2026 - 14 pax".
  const importTag = `import CSV ${meseSel}/${annoSel}`;

  const handleFile = async (file: File) => {
    setParsing(true);
    setDone(null);
    try {
      const text = await file.text();
      // Fetch vendite FH esistenti (dedup per importTag)
      const existingRes = await fetch(
        `/api/vendite?canale=${encodeURIComponent(FH_CANALE)}`,
      );
      const existing = (await existingRes.json()) as ExistingFhVendita[];
      const existingForMonth = existing.filter((v) =>
        (v.note ?? "").includes(importTag),
      );

      const result = Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
      });
      const errori: string[] = [];
      result.errors.forEach((e) =>
        errori.push(`Parser riga ${e.row}: ${e.message}`),
      );
      const allRows = result.data;
      // Trova la riga header (quella che contiene "Item" come cella)
      const headerIdx = allRows.findIndex((r) =>
        r.some((c) => c.trim().toLowerCase() === "item"),
      );
      if (headerIdx < 0) {
        setParsed({
          valide: [],
          duplicate: [],
          nonTrovati: [],
          errori: [
            "Header non trovato. Atteso una riga con la colonna 'Item'.",
          ],
        });
        return;
      }
      const header = allRows[headerIdx].map((c) => c.trim());
      const colIdx = (re: RegExp) =>
        header.findIndex((c) => re.test(c.toLowerCase()));
      const itemCol = colIdx(/^item$/i);
      const bookingsCol = colIdx(/(^|\s)#?\s*of\s+bookings?/);
      const paxCol = colIdx(/(^|\s)#?\s*of\s+pax/);
      const paidCol = colIdx(/total\s*paid/);
      if (itemCol < 0 || bookingsCol < 0 || paidCol < 0) {
        setParsed({
          valide: [],
          duplicate: [],
          nonTrovati: [],
          errori: [
            `Colonne mancanti. Trovate: ${header.join(", ")}. Servono: Item, # of Bookings, Total Paid (Pax opzionale).`,
          ],
        });
        return;
      }
      // Righe dopo header, escludendo l'ultima (totale riepilogativo)
      const dataRows = allRows.slice(headerIdx + 1);
      // Trim trailing empty/total row
      const filtered = dataRows.filter((r, i) => {
        const item = (r[itemCol] ?? "").trim();
        const isLast = i === dataRows.length - 1;
        const looksLikeTotal =
          /^total/i.test(item) || item === "" || /^grand/i.test(item);
        if (isLast && looksLikeTotal) return false;
        return true;
      });

      const valide: FHBookingParsedRow[] = [];
      const duplicate: FHBookingParsedRow[] = [];
      const nonTrovati: FHBookingParsedRow[] = [];

      for (let i = 0; i < filtered.length; i++) {
        const r = filtered[i];
        const nomeProdotto = (r[itemCol] ?? "").trim();
        if (!nomeProdotto) {
          errori.push(`Riga ${headerIdx + 2 + i}: Item vuoto, skip`);
          continue;
        }
        const bookings = parseInt(String(r[bookingsCol] ?? "0").trim()) || 0;
        const pax =
          paxCol >= 0 ? parseInt(String(r[paxCol] ?? "0").trim()) || 0 : 0;
        const totalPaid = parseGross(String(r[paidCol] ?? "0"));
        if (bookings <= 0 || totalPaid <= 0) {
          errori.push(
            `Riga ${headerIdx + 2 + i} "${nomeProdotto}": bookings=${bookings} totalPaid=${totalPaid} ignorata`,
          );
          continue;
        }

        const prod = prodottoByName.get(nomeProdotto.toLowerCase());
        const dupExisting = prod
          ? existingForMonth.find((v) => v.prodottoId === prod.id) ?? null
          : null;
        const row: FHBookingParsedRow = {
          nomeProdotto,
          bookings,
          pax,
          totalPaid,
          matchedProdottoId: prod?.id ?? null,
          duplicateExistingId: dupExisting?.id ?? null,
        };
        if (!prod) nonTrovati.push(row);
        else if (dupExisting) duplicate.push(row);
        else valide.push(row);
      }

      setParsed({ valide, duplicate, nonTrovati, errori });
      // Reset overwrite se non ci sono duplicati
      if (duplicate.length === 0) setOverwrite(false);
    } catch (e) {
      setParsed({
        valide: [],
        duplicate: [],
        nonTrovati: [],
        errori: [String(e)],
      });
    } finally {
      setParsing(false);
    }
  };

  const conferma = async () => {
    if (!parsed) return;
    setImporting(true);
    const dataRiferimento = lastDayOfMonth(annoSel, meseSel);
    // Lista finale da creare: valide + (duplicate solo se overwrite)
    const toCreate: FHBookingParsedRow[] = overwrite
      ? [...parsed.valide, ...parsed.duplicate]
      : parsed.valide;

    const errors: string[] = [];
    let overwritten = 0;
    // Se overwrite attivo, elimina prima le esistenti
    if (overwrite) {
      for (const r of parsed.duplicate) {
        if (r.duplicateExistingId == null) continue;
        try {
          const res = await fetch(`/api/vendite/${r.duplicateExistingId}`, {
            method: "DELETE",
          });
          if (res.ok) overwritten++;
          else errors.push(`Delete ${r.nomeProdotto}: ${res.status}`);
        } catch (e) {
          errors.push(`Delete ${r.nomeProdotto}: ${String(e)}`);
        }
      }
    }

    let created = 0;
    for (const r of toCreate) {
      if (r.matchedProdottoId == null) continue;
      const prezzoUnit = r.bookings > 0 ? r.totalPaid / r.bookings : 0;
      try {
        const res = await fetch("/api/vendite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prodottoId: r.matchedProdottoId,
            quantita: r.bookings,
            prezzoUnitario: Math.round(prezzoUnit * 100) / 100,
            data: dataRiferimento,
            canale: FH_CANALE,
            note: `${importTag} - ${r.pax} pax`,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          errors.push(`${r.nomeProdotto}: ${err.error ?? res.status}`);
        } else {
          created++;
        }
      } catch (e) {
        errors.push(`${r.nomeProdotto}: ${String(e)}`);
      }
    }
    setImporting(false);
    setDone({ created, overwritten, errors });
    if (created > 0 && errors.length === 0) {
      onImported();
    }
  };

  const nomiNonTrovati = useMemo(() => {
    if (!parsed) return [];
    const set = new Set<string>();
    for (const r of parsed.nonTrovati) set.add(r.nomeProdotto);
    return Array.from(set).sort();
  }, [parsed]);

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
            Importa FareHarbor — Custom bookings report
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: mese/anno + dropzone */}
        {!parsed && !done && (
          <>
            <div className="rounded-xl p-3 bg-sky-50 border border-sky-200 text-xs text-sky-800">
              Seleziona il <strong>mese e anno</strong> di riferimento del
              report prima di caricare il CSV. Le vendite saranno datate
              all&apos;ultimo giorno del mese selezionato.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Mese
                </label>
                <select
                  value={meseSel}
                  onChange={(e) => setMeseSel(parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                >
                  {MESI_LABEL.map((nome, i) => (
                    <option key={i + 1} value={i + 1}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Anno
                </label>
                <select
                  value={annoSel}
                  onChange={(e) => setAnnoSel(parseInt(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
                >
                  {ANNI.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
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
              onClick={() => fileInputRef.current?.click()}
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
                {parsing
                  ? "Parsing in corso..."
                  : "Trascina il CSV o clicca per selezionarlo"}
              </p>
              <p className="text-xs text-gray-500 text-center">
                Colonne attese (header alla riga 2):{" "}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                  Item · # of Bookings · # of Pax · Total Paid
                </code>
                <br />
                Una riga per prodotto; l&apos;ultima riga di totale viene
                ignorata.
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
          </>
        )}

        {/* Step 2: preview */}
        {parsed && !done && (
          <>
            <div className="rounded-xl px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-gray-700">
              Periodo di import:{" "}
              <strong>
                {MESI_LABEL[meseSel - 1]} {annoSel}
              </strong>{" "}
              · data vendite: <strong>{lastDayOfMonth(annoSel, meseSel)}</strong>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatTile
                label="Da importare"
                value={parsed.valide.length}
                color="#16a34a"
              />
              <StatTile
                label={`Duplicate ${overwrite ? "(sovrascrivi)" : "(skip)"}`}
                value={parsed.duplicate.length}
                color={overwrite ? "#ca8a04" : "#64748b"}
              />
              <StatTile
                label="Prodotti non trovati"
                value={parsed.nonTrovati.length}
                color="#ef4444"
              />
            </div>

            {parsed.duplicate.length > 0 && (
              <div className="rounded-xl p-3 bg-amber-50 border border-amber-200">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="w-4 h-4 mt-0.5"
                    style={{ accentColor: "#ca8a04" }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900">
                      Sovrascrivi {parsed.duplicate.length} vendite esistenti
                      per {MESI_LABEL[meseSel - 1]} {annoSel}
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Esistono già vendite FareHarbor importate per questo
                      mese. Se attivo, verranno eliminate e ricreate con i
                      nuovi valori.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {nomiNonTrovati.length > 0 && (
              <div className="rounded-xl p-3 bg-red-50 border border-red-200 text-sm">
                <p className="font-semibold text-red-800 mb-1">
                  Prodotti non trovati in catalogo
                </p>
                <p className="text-xs text-red-700 mb-2">
                  Crea questi prodotti prima di importare per non perderli:
                </p>
                <ul className="space-y-0.5">
                  {nomiNonTrovati.map((n) => (
                    <li
                      key={n}
                      className="text-xs text-red-700 flex items-start gap-1.5"
                    >
                      <span className="opacity-60">•</span>
                      <span className="font-mono">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(parsed.valide.length > 0 || parsed.duplicate.length > 0) && (
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <p className="bg-gray-50 border-b border-gray-200 px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Anteprima ({Math.min(
                    5,
                    parsed.valide.length + parsed.duplicate.length,
                  )}{" "}
                  di {parsed.valide.length + parsed.duplicate.length})
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        "Prodotto",
                        "Bookings",
                        "Pax",
                        "Prezzo unit.",
                        "Totale",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`text-[10px] uppercase tracking-wide text-gray-500 font-semibold px-3 py-2 ${i === 0 ? "text-left" : "text-right"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="zebra">
                    {[...parsed.valide, ...parsed.duplicate]
                      .slice(0, 5)
                      .map((r, i) => {
                        const unit = r.bookings > 0
                          ? Math.round((r.totalPaid / r.bookings) * 100) / 100
                          : 0;
                        return (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-3 py-2 text-gray-900 font-medium">
                              {r.nomeProdotto}
                              {r.duplicateExistingId != null && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                                  esistente
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {r.bookings}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">
                              {r.pax}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {fmt(unit)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900">
                              {fmt(r.totalPaid)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {parsed.errori.length > 0 && (
              <details className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-amber-800">
                  {parsed.errori.length} righe scartate per errore di parsing
                </summary>
                <ul className="mt-2 space-y-0.5 text-amber-700">
                  {parsed.errori.slice(0, 20).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                  {parsed.errori.length > 20 && (
                    <li>… +{parsed.errori.length - 20} altri</li>
                  )}
                </ul>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setParsed(null);
                  setOverwrite(false);
                }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={conferma}
                disabled={
                  importing ||
                  (parsed.valide.length === 0 &&
                    (parsed.duplicate.length === 0 || !overwrite))
                }
                className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
              >
                {importing
                  ? "Importazione…"
                  : `Conferma import (${parsed.valide.length + (overwrite ? parsed.duplicate.length : 0)})`}
              </button>
            </div>
          </>
        )}

        {/* Step 3: done */}
        {done && (
          <>
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: done.errors.length === 0 ? "#dcfce7" : "#fef3c7",
                color: done.errors.length === 0 ? "#166534" : "#92400e",
              }}
            >
              {done.errors.length === 0 ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold">
                  {done.created} vendite create
                  {done.overwritten > 0 &&
                    ` · ${done.overwritten} sovrascritte`}
                  {done.errors.length > 0 && ` · ${done.errors.length} errori`}
                </p>
                {done.errors.length > 0 && (
                  <ul className="text-xs mt-1 space-y-0.5 opacity-80">
                    {done.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={onImported}
                className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl"
              >
                Chiudi
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ─── Modal scelta export PDF ──────────────────────────────────────────

function PdfExportModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (sections: ProdottiPDFSections) => void;
}) {
  const options: Array<{
    icon: string;
    label: string;
    desc: string;
    sections: ProdottiPDFSections;
  }> = [
    {
      icon: "📄",
      label: "Esporta tutto",
      desc: "Catalogo, vendite e statistiche in un unico PDF",
      sections: { catalogo: true, vendite: true, stats: true },
    },
    {
      icon: "📋",
      label: "Solo Catalogo & Margini",
      desc: "Solo la tabella catalogo con i margini calcolati",
      sections: { catalogo: true, vendite: false, stats: false },
    },
    {
      icon: "🧾",
      label: "Solo Vendite",
      desc: "Lista vendite dell'anno selezionato",
      sections: { catalogo: false, vendite: true, stats: false },
    },
    {
      icon: "📊",
      label: "Solo Statistiche",
      desc: "Top prodotti per ricavo e ranking margini",
      sections: { catalogo: false, vendite: false, stats: true },
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Esporta PDF</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Scegli cosa includere nel report:
        </p>

        <div className="space-y-2">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => onPick(opt.sections)}
              className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-all text-left"
            >
              <span className="text-2xl shrink-0 leading-none">
                {opt.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {opt.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
