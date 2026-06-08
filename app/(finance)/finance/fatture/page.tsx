"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  X,
  Check,
  Mail,
  Phone,
  FileText,
  FileClock,
  FileEdit,
} from "lucide-react";
import { fmt, TIPO_IMPOSTA_OPTIONS, MESI, ANNI } from "@/lib/constants";
import FiltriBar from "@/components/FiltriBar";
import { PageSizeSelect, PageNav } from "@/components/Pagination";
import { exportFatturaPDF } from "@/lib/export";
import AddressFields from "@/components/AddressFields";

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
  iban: string | null;
  note: string | null;
  tipo: string;
  fatture?: Array<{
    id: number;
    numero: string | null;
    data: string | null;
    totale: number;
    pagato: boolean;
  }>;
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
  prezzoConIva: boolean;
  tipo: "fattura" | "proforma" | "preventivo";
  stato: "in_attesa" | "accettato" | "rifiutato" | null;
  daDocumentoOrigine: string | null;
  baseImponibile: number;
  iva: number;
  totale: number;
  pagato: boolean;
  metodoPagamento: string | null;
  mese: number;
  anno: number;
  note: string | null;
}

type StatoDoc = "in_attesa" | "accettato" | "rifiutato";
const STATO_LABEL: Record<StatoDoc, string> = {
  in_attesa: "In attesa",
  accettato: "Accettato",
  rifiutato: "Rifiutato",
};
// Palette badge stato — stesso stile pill del badge "Pagata" già usato
// per le fatture. Niente emoji/icone semaforo, solo colori di sfondo.
const STATO_BADGE: Record<StatoDoc, { bg: string; color: string }> = {
  in_attesa: { bg: "#f3f4f6", color: "#374151" },
  accettato: { bg: "#dcfce7", color: "#166534" },
  rifiutato: { bg: "#fee2e2", color: "#991b1b" },
};

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

// ─── Page (tab switcher) ──────────────────────────────────────────────

export default function FatturePage() {
  const [tab, setTab] = useState<
    "fatture" | "clienti" | "altri" | "proforma" | "preventivi"
  >("fatture");

  const tabLabel: Record<typeof tab, string> = {
    fatture: "Fatture",
    clienti: "Clienti",
    altri: "Altri Ingressi",
    proforma: "Proforma",
    preventivi: "Preventivi",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fatture & Clienti</h1>
        <p className="text-gray-500 text-sm mt-1">
          Fatture emesse, anagrafica clienti, altri ingressi, proforma e
          preventivi
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 flex-wrap">
        {(
          ["fatture", "clienti", "altri", "proforma", "preventivi"] as const
        ).map((t) => {
          const active = tab === t;
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
              {tabLabel[t]}
            </button>
          );
        })}
      </div>

      {tab === "fatture" && <FattureTab tipo="fattura" />}
      {tab === "proforma" && <FattureTab tipo="proforma" />}
      {tab === "preventivi" && <FattureTab tipo="preventivo" />}
      {tab === "clienti" && <ClientiTab />}
      {tab === "altri" && <AltriIngressiTab />}
    </div>
  );
}

// ─── Fatture Tab ───────────────────────────────────────────────────────

type TipoDocumento = "fattura" | "proforma" | "preventivo";

const TIPO_LABEL_SING: Record<TipoDocumento, string> = {
  fattura: "Fattura",
  proforma: "Proforma",
  preventivo: "Preventivo",
};
const TIPO_LABEL_PLUR: Record<TipoDocumento, string> = {
  fattura: "fatture",
  proforma: "proforma",
  preventivo: "preventivi",
};

function FattureTab({ tipo = "fattura" }: { tipo?: TipoDocumento }) {
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fattura | null>(null);
  // Tipo del nuovo documento da creare. Sulla tab "fattura" si può scegliere
  // tramite dropdown tra le 3 opzioni; sulle tab proforma/preventivi è già
  // fissato dalla tab corrente.
  const [newDocTipo, setNewDocTipo] = useState<TipoDocumento>(tipo);
  const [showNewMenu, setShowNewMenu] = useState(false);
  // Proforma e preventivi non hanno il concetto di "pagato": niente KPI
  // incassato/da incassare, niente colonna Stato, niente filtro stato.
  const showStato = tipo === "fattura";
  // Dropdown solo sulla tab fattura (sulle altre il tipo è già implicito)
  const useDropdown = tipo === "fattura";

  const openNew = (docTipo: TipoDocumento) => {
    setEditing(null);
    setNewDocTipo(docTipo);
    setShowForm(true);
    setShowNewMenu(false);
  };

  // Flash message inline (es. "Fattura F-X/2026 creata")
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!flashMsg) return;
    const t = setTimeout(() => setFlashMsg(null), 5000);
    return () => clearTimeout(t);
  }, [flashMsg]);

  // Cambia stato di un proforma/preventivo. Se passa ad "accettato" e non
  // lo era prima, chiede se convertirlo in fattura.
  const changeStato = async (f: Fattura, nuovoStato: StatoDoc) => {
    let convert = false;
    if (nuovoStato === "accettato" && f.stato !== "accettato") {
      convert = confirm(
        "Vuoi creare automaticamente una fattura da questo documento?",
      );
    }
    await fetch(`/api/fatture/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: nuovoStato }),
    });
    if (convert) {
      let righeArr: unknown[] = [];
      try {
        const parsed = JSON.parse(f.righe);
        if (Array.isArray(parsed)) righeArr = parsed;
      } catch {
        // ignore
      }
      const res = await fetch("/api/fatture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "fattura",
          clienteId: f.clienteId,
          data: f.data,
          scadenza: f.scadenza,
          righe: righeArr,
          iva: f.iva,
          prezzoConIva: f.prezzoConIva,
          pagato: false,
          metodoPagamento: f.metodoPagamento,
          note: f.note,
          daDocumentoOrigine: f.numero,
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as Fattura;
        setFlashMsg(`Fattura ${created.numero} creata con successo`);
      } else {
        setFlashMsg("Errore creazione fattura");
      }
    }
    load();
  };

  const load = async () => {
    const [fRes, cRes] = await Promise.all([
      fetch(`/api/fatture?anno=${anno}&tipo=${tipo}`),
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
  }, [anno, tipo]);

  const q = search.toLowerCase();
  const filtered = fatture.filter((f) => {
    if (statusFilter === "pagate" && !f.pagato) return false;
    if (statusFilter === "scadute" && f.pagato) return false;
    const nome =
      `${f.cliente?.nome ?? ""} ${f.cliente?.cognome ?? ""}`.toLowerCase();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-sm">
          {filtered.length} {TIPO_LABEL_PLUR[tipo]} · anno {anno}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <FiltriBar anno={anno} onAnno={setAnno} />
          {showStato && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
            >
              <option value="">Tutte</option>
              <option value="pagate">Pagate</option>
              <option value="scadute">Non pagate</option>
            </select>
          )}
          <PageSizeSelect pageSize={pageSize} onChange={setPageSize} />
          {useDropdown ? (
            <div className="relative">
              <button
                onClick={() => setShowNewMenu((v) => !v)}
                className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
              >
                <Plus className="w-4 h-4" /> Nuovo
              </button>
              {showNewMenu && (
                <>
                  {/* Overlay invisibile per chiudere su click esterno */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNewMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[180px]">
                    {(
                      [
                        {
                          tipo: "fattura" as const,
                          label: "Fattura",
                          Icon: FileText,
                        },
                        {
                          tipo: "proforma" as const,
                          label: "Proforma",
                          Icon: FileClock,
                        },
                        {
                          tipo: "preventivo" as const,
                          label: "Preventivo",
                          Icon: FileEdit,
                        },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.tipo}
                        onClick={() => openNew(opt.tipo)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-sky-50 hover:text-sky-700 text-left"
                      >
                        <opt.Icon
                          className="w-4 h-4 shrink-0"
                          style={{ color: "#0ea5e9" }}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => openNew(tipo)}
              className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
            >
              <Plus className="w-4 h-4" />{" "}
              {tipo === "proforma" ? "Nuovo Proforma" : "Nuovo Preventivo"}
            </button>
          )}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per numero o azienda..."
        className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
      />

      {flashMsg && (
        <div
          className="rounded-xl p-3 flex items-center gap-2 text-sm font-medium"
          style={{ background: "#dcfce7", color: "#166534" }}
        >
          <Check className="w-4 h-4 shrink-0" />
          <span className="flex-1">{flashMsg}</span>
          <button
            onClick={() => setFlashMsg(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 ${showStato ? "sm:grid-cols-3" : "sm:grid-cols-1"} gap-3`}>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            {tipo === "fattura"
              ? `Fatturato ${anno}`
              : `Totale ${TIPO_LABEL_PLUR[tipo]} ${anno}`}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(totaleFatturato)}
          </p>
        </div>
        {showStato && (
          <>
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
          </>
        )}
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
                  <td
                    colSpan={9}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    {tipo === "fattura"
                      ? "Nessuna fattura trovata"
                      : tipo === "proforma"
                        ? "Nessun proforma trovato"
                        : "Nessun preventivo trovato"}
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
                      <div className="flex flex-col">
                        <span>{f.numero ?? "—"}</span>
                        {f.daDocumentoOrigine && (
                          <span className="text-[10px] font-normal text-gray-400">
                            Da {f.daDocumentoOrigine}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {f.data
                        ? new Date(f.data).toLocaleDateString("it-IT")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{nome}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {fmt(f.baseImponibile)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 text-right">
                      {f.iva}%
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {fmt(f.totale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {f.scadenza
                        ? new Date(f.scadenza).toLocaleDateString("it-IT")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {showStato ? (
                        // Fattura: toggle pagato/non pagato
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
                      ) : (
                        // Proforma/Preventivo: pill stato cliccabile (select
                        // mascherato senza freccia, stile coerente con la
                        // pill "Pagata" delle fatture).
                        <select
                          value={f.stato ?? "in_attesa"}
                          onChange={(e) =>
                            changeStato(f, e.target.value as StatoDoc)
                          }
                          className="appearance-none inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-sky-300"
                          style={{
                            background:
                              STATO_BADGE[
                                (f.stato as StatoDoc) ?? "in_attesa"
                              ].bg,
                            color:
                              STATO_BADGE[
                                (f.stato as StatoDoc) ?? "in_attesa"
                              ].color,
                            paddingRight: "0.5rem",
                          }}
                          title="Cambia stato"
                        >
                          {(
                            ["in_attesa", "accettato", "rifiutato"] as const
                          ).map((s) => (
                            <option key={s} value={s}>
                              {STATO_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      )}
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
          initialTipo={editing?.tipo ?? newDocTipo}
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
  initialTipo = "fattura",
  onClose,
  onSaved,
}: {
  editing: Fattura | null;
  clienti: Cliente[];
  initialTipo?: TipoDocumento;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Tipo è fissato per la nuova creazione (deciso dal tab/dropdown). In
  // edit prende sempre il valore dal record esistente.
  const tipo: TipoDocumento = editing?.tipo ?? initialTipo;
  const isFattura = tipo === "fattura";
  const [clienteId, setClienteId] = useState<string>(
    editing?.clienteId ? String(editing.clienteId) : "",
  );
  // Lista locale dei clienti — parte dalla prop ma può crescere quando
  // l'utente crea un cliente inline, senza dover ricaricare il modal.
  const [localClienti, setLocalClienti] = useState<Cliente[]>(clienti);
  useEffect(() => {
    setLocalClienti(clienti);
  }, [clienti]);
  // Mini-form inline per creare un nuovo cliente al volo
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newCli, setNewCli] = useState({
    nome: "",
    partitaIva: "",
    email: "",
    telefono: "",
    via: "",
    cap: "",
    citta: "",
    paese: "Spagna",
  });
  const [creatingCli, setCreatingCli] = useState(false);
  const resetNewCli = () => {
    setNewCli({
      nome: "",
      partitaIva: "",
      email: "",
      telefono: "",
      via: "",
      cap: "",
      citta: "",
      paese: "Spagna",
    });
  };
  const createAndSelectCliente = async () => {
    const nome = newCli.nome.trim();
    if (!nome) {
      alert("Nome / Ragione sociale obbligatori");
      return;
    }
    setCreatingCli(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          partitaIva: newCli.partitaIva.trim() || null,
          email: newCli.email.trim() || null,
          telefono: newCli.telefono.trim() || null,
          via: newCli.via.trim() || null,
          cap: newCli.cap.trim() || null,
          citta: newCli.citta.trim() || null,
          paese: newCli.paese.trim() || "Spagna",
        }),
      });
      if (!res.ok) {
        alert("Errore creazione cliente");
        return;
      }
      const created = (await res.json()) as Cliente;
      setLocalClienti((prev) =>
        [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      setClienteId(String(created.id));
      setShowNewCliente(false);
      resetNewCli();
    } finally {
      setCreatingCli(false);
    }
  };
  const [data, setData] = useState<string>(
    editing?.data ? isoDate(editing.data) : isoDate(new Date()),
  );
  const [scadenza, setScadenza] = useState<string>(
    editing?.scadenza
      ? isoDate(editing.scadenza)
      : addDays(isoDate(new Date()), 30),
  );
  const clienteSelezionato = localClienti.find(
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
  const [prezzoConIva, setPrezzoConIva] = useState<boolean>(
    editing?.prezzoConIva ?? false,
  );
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

  const sommaRighe = righe.reduce(
    (s, r) =>
      s + (Number(r.quantita) || 0) * (Number(r.prezzoUnitario) || 0),
    0,
  );
  const ivaNum = Number(iva) || 0;
  // Modalità prezzo lordo: la somma delle righe È il totale (IVA inclusa),
  // base si ricava dividendo per (1 + iva%). Modalità netto (default): la
  // somma è la base, IVA si somma sopra.
  const baseImponibile = prezzoConIva
    ? round2(sommaRighe / (1 + ivaNum / 100))
    : round2(sommaRighe);
  const totale = prezzoConIva
    ? round2(sommaRighe)
    : round2(baseImponibile * (1 + ivaNum / 100));
  const ivaImporto = round2(totale - baseImponibile);

  const updateRiga = (i: number, patch: Partial<Riga>) => {
    setRighe((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
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
        prezzoConIva,
        tipo,
        // Proforma e preventivi non hanno stato "pagato": forziamo false
        pagato: isFattura ? pagato : false,
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
            {editing
              ? `Modifica ${editing.numero ?? TIPO_LABEL_SING[tipo]}`
              : `Nuovo ${TIPO_LABEL_SING[tipo]}`}
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
            <div className="flex items-stretch gap-2">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                disabled={showNewCliente}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white disabled:opacity-50"
              >
                <option value="">Seleziona cliente...</option>
                {localClienti.map((c) => (
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
              {!showNewCliente && (
                <button
                  type="button"
                  onClick={() => setShowNewCliente(true)}
                  className="glass-btn-secondary flex items-center gap-1 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg whitespace-nowrap"
                  title="Crea un nuovo cliente al volo"
                >
                  <Plus className="w-4 h-4" style={{ color: "#0ea5e9" }} />
                  Nuovo cliente
                </button>
              )}
            </div>

            {/* Mini-form inline creazione nuovo cliente */}
            {showNewCliente && (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/30 p-3 space-y-3">
                <p className="text-xs font-semibold text-sky-800">
                  Nuovo cliente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">
                      Nome / Ragione sociale *
                    </label>
                    <input
                      type="text"
                      value={newCli.nome}
                      onChange={(e) =>
                        setNewCli((c) => ({ ...c, nome: e.target.value }))
                      }
                      placeholder="Es. Acme SL"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">
                      DNI / CIF
                    </label>
                    <input
                      type="text"
                      value={newCli.partitaIva}
                      onChange={(e) =>
                        setNewCli((c) => ({
                          ...c,
                          partitaIva: e.target.value,
                        }))
                      }
                      placeholder="B12345678 / 12345678A"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={newCli.email}
                      onChange={(e) =>
                        setNewCli((c) => ({ ...c, email: e.target.value }))
                      }
                      placeholder="cliente@…"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-medium text-gray-600 block mb-1">
                      Telefono
                    </label>
                    <input
                      type="tel"
                      value={newCli.telefono}
                      onChange={(e) =>
                        setNewCli((c) => ({
                          ...c,
                          telefono: e.target.value,
                        }))
                      }
                      placeholder="+34 …"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                </div>
                {/* Indirizzo con autocomplete CAP (Nominatim) */}
                <AddressFields
                  value={{
                    via: newCli.via,
                    cap: newCli.cap,
                    citta: newCli.citta,
                    provincia: "",
                    paese: newCli.paese,
                  }}
                  onChange={(v) =>
                    setNewCli((c) => ({
                      ...c,
                      via: v.via,
                      cap: v.cap,
                      citta: v.citta,
                      paese: v.paese,
                    }))
                  }
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCliente(false);
                      resetNewCli();
                    }}
                    className="text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={createAndSelectCliente}
                    disabled={!newCli.nome.trim() || creatingCli}
                    className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {creatingCli ? "Salvataggio…" : "Crea e seleziona"}
                  </button>
                </div>
              </div>
            )}
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
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Righe
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prezzoConIva}
                  onChange={(e) => setPrezzoConIva(e.target.checked)}
                  className="w-3.5 h-3.5"
                  style={{ accentColor: "#0ea5e9" }}
                />
                <span className="text-xs text-gray-700">
                  Prezzo unitario IVA inclusa
                </span>
              </label>
            </div>
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
                  onChange={(e) =>
                    updateRiga(i, { descrizione: e.target.value })
                  }
                  placeholder="Descrizione"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={r.quantita}
                  onChange={(e) => {
                    const n = Math.max(
                      1,
                      Math.round(parseFloat(e.target.value) || 1),
                    );
                    updateRiga(i, { quantita: n });
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-300"
                />
                <div className="flex flex-col gap-0.5">
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
                  <span className="text-[9px] text-gray-500 text-right leading-none">
                    {prezzoConIva ? "Precio con IVA" : "Precio sin IVA"}
                  </span>
                </div>
                <div className="px-2 py-2 text-sm text-right font-semibold text-gray-800 bg-gray-50 rounded-lg">
                  {fmt(
                    round2(
                      (Number(r.quantita) || 0) *
                        (Number(r.prezzoUnitario) || 0),
                    ),
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
            <p className="text-sm font-bold text-gray-900">
              {fmt(baseImponibile)}
            </p>
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
          {isFattura && (
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pagato}
                  onChange={(e) => setPagato(e.target.checked)}
                  className="w-4 h-4"
                  style={{ accentColor: "#0ea5e9" }}
                />
                <span className="text-sm text-gray-700 font-medium">
                  Pagata
                </span>
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Note
          </label>
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

// ─── Clienti Tab ───────────────────────────────────────────────────────

function ClientiTab() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [detail, setDetail] = useState<Cliente | null>(null);

  const load = async () => {
    const res = await fetch("/api/clienti");
    const data = await res.json();
    setClienti(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const q = search.toLowerCase();
  const filtered = clienti.filter((c) => {
    if (tipoFiltro && c.tipo !== tipoFiltro) return false;
    return (
      (c.nome ?? "").toLowerCase().includes(q) ||
      (c.cognome ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.partitaIva ?? "").toLowerCase().includes(q) ||
      (c.dni ?? "").toLowerCase().includes(q)
    );
  });

  const del = async (id: number) => {
    if (
      !confirm(
        "Eliminare questo cliente? Le fatture collegate verranno scollegate (non eliminate).",
      )
    )
      return;
    await fetch(`/api/clienti/${id}`, { method: "DELETE" });
    if (detail?.id === id) setDetail(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-sm">
          {filtered.length} clienti in anagrafica
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            <option value="">Tutti i tipi</option>
            <option value="privato">Privato</option>
            <option value="azienda">Azienda</option>
          </select>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Aggiungi Cliente
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per nome, email, P.IVA, DNI..."
        className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
      />

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Nome",
                  "Cognome",
                  "Email",
                  "Telefono",
                  "DNI / P.IVA",
                  "Tipo",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    Nessun cliente trovato
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setDetail(c)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {c.nome}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.cognome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {c.telefono ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                    {c.partitaIva || c.dni || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                      style={
                        c.tipo === "azienda"
                          ? { background: "#e0f2fe", color: "#0369a1" }
                          : { background: "#f1f5f9", color: "#475569" }
                      }
                    >
                      {c.tipo}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditing(c);
                          setShowForm(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                        title="Modifica"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(c.id)}
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

      {detail && (
        <ClienteDetailModal
          cliente={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const c = detail;
            setDetail(null);
            setEditing(c);
            setShowForm(true);
          }}
        />
      )}

      {showForm && (
        <ClienteFormModal
          editing={editing}
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

// ─── Cliente Form Modal ────────────────────────────────────────────────

function ClienteFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: editing?.nome ?? "",
    cognome: editing?.cognome ?? "",
    dni: editing?.dni ?? "",
    email: editing?.email ?? "",
    telefono: editing?.telefono ?? "",
    partitaIva: editing?.partitaIva ?? "",
    via: editing?.via ?? "",
    cap: editing?.cap ?? "",
    citta: editing?.citta ?? "",
    provincia: editing?.provincia ?? "",
    paese: editing?.paese ?? "Spagna",
    iban: editing?.iban ?? "",
    tipo: editing?.tipo ?? "privato",
    note: editing?.note ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/clienti/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/clienti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const Input = (
    k: keyof typeof form,
    label: string,
    placeholder = "",
    type = "text",
  ) => (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[k] as string}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
    </div>
  );

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
            {editing ? "Modifica Cliente" : "Nuovo Cliente"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {Input("nome", "Nome / Ragione Sociale *", "Mario / Acme SL")}
          {Input("cognome", "Cognome", "Rossi")}
          {Input("dni", "DNI / NIE", "X1234567Y")}
          {Input("partitaIva", "Partita IVA / NIF", "B12345678")}
          {Input("email", "Email", "info@cliente.es", "email")}
          {Input("telefono", "Telefono", "+34 600...", "tel")}

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Tipo
            </label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white capitalize"
            >
              <option value="privato">Privato</option>
              <option value="azienda">Azienda</option>
            </select>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Indirizzo
            </p>
            <AddressFields
              value={{
                via: form.via,
                cap: form.cap,
                citta: form.citta,
                provincia: form.provincia,
                paese: form.paese,
              }}
              onChange={(a) =>
                setForm((f) => ({
                  ...f,
                  via: a.via,
                  cap: a.cap,
                  citta: a.citta,
                  provincia: a.provincia,
                  paese: a.paese,
                }))
              }
            />
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
            disabled={saving || !form.nome.trim()}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cliente Detail Modal ──────────────────────────────────────────────

function ClienteDetailModal({
  cliente,
  onClose,
  onEdit,
}: {
  cliente: Cliente;
  onClose: () => void;
  onEdit: () => void;
}) {
  const fatture = cliente.fatture ?? [];
  const totale = fatture.reduce((s, f) => s + f.totale, 0);
  const incassato = fatture
    .filter((f) => f.pagato)
    .reduce((s, f) => s + f.totale, 0);
  const daIncassare = totale - incassato;

  const indirizzo = [cliente.via, cliente.cap, cliente.citta, cliente.paese]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">
                {cliente.nome} {cliente.cognome ?? ""}
              </h2>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                style={
                  cliente.tipo === "azienda"
                    ? { background: "#e0f2fe", color: "#0369a1" }
                    : { background: "#f1f5f9", color: "#475569" }
                }
              >
                {cliente.tipo}
              </span>
            </div>
            {(cliente.partitaIva || cliente.dni) && (
              <p className="text-xs text-gray-500 mt-0.5 font-mono">
                {cliente.partitaIva || cliente.dni}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anagrafica */}
        <div className="bg-white/60 rounded-xl p-4 space-y-2">
          {cliente.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail className="w-4 h-4 text-gray-400" />
              <a
                href={`mailto:${cliente.email}`}
                className="hover:text-sky-600"
              >
                {cliente.email}
              </a>
            </div>
          )}
          {cliente.telefono && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone className="w-4 h-4 text-gray-400" />
              <a
                href={`tel:${cliente.telefono}`}
                className="hover:text-sky-600"
              >
                {cliente.telefono}
              </a>
            </div>
          )}
          {indirizzo && <p className="text-sm text-gray-700">{indirizzo}</p>}
          {cliente.iban && (
            <p className="text-xs text-gray-500 font-mono">
              IBAN: {cliente.iban}
            </p>
          )}
          {cliente.note && (
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              {cliente.note}
            </p>
          )}
        </div>

        {/* Fatture stats */}
        <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Fatturato
            </p>
            <p className="text-sm font-bold text-gray-900">{fmt(totale)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Incassato
            </p>
            <p className="text-sm font-bold" style={{ color: "#22c55e" }}>
              {fmt(incassato)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">
              Da incassare
            </p>
            <p className="text-sm font-bold" style={{ color: "#f59e0b" }}>
              {fmt(daIncassare)}
            </p>
          </div>
        </div>

        {/* Fatture collegate */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2">
            Fatture collegate ({fatture.length})
          </h3>
          {fatture.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Nessuna fattura per questo cliente
            </p>
          ) : (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">
                      Numero
                    </th>
                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">
                      Data
                    </th>
                    <th className="text-right px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">
                      Totale
                    </th>
                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase">
                      Stato
                    </th>
                  </tr>
                </thead>
                <tbody className="zebra">
                  {fatture.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">
                        {f.numero ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {f.data
                          ? new Date(f.data).toLocaleDateString("it-IT")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {fmt(f.totale)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={
                            f.pagato
                              ? { background: "#dcfce7", color: "#166534" }
                              : { background: "#fef3c7", color: "#92400e" }
                          }
                        >
                          {f.pagato ? "Pagata" : "Non pagata"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
            Modifica Cliente
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Altri Ingressi Tab ────────────────────────────────────────────────

interface AltroIngresso {
  id: number;
  fonte: string;
  descrizione: string | null;
  mese: number;
  anno: number;
  importo: number;
  incassato: boolean;
  dataIncasso: string | null;
}

function AltriIngressiTab() {
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<AltroIngresso[]>([]);
  const [meseFiltro, setMeseFiltro] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AltroIngresso | null>(null);

  const load = async () => {
    const res = await fetch(`/api/altri-ingressi?anno=${anno}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const filtered = meseFiltro
    ? rows.filter((r) => r.mese === meseFiltro)
    : rows;

  const totaliMensili = useMemo(() => {
    const t = new Array(12).fill(0);
    for (const r of rows) t[r.mese - 1] += r.importo;
    return t;
  }, [rows]);

  const totaleAnno = rows.reduce((s, r) => s + r.importo, 0);
  const incassatoAnno = rows
    .filter((r) => r.incassato)
    .reduce((s, r) => s + r.importo, 0);
  const daIncassareAnno = totaleAnno - incassatoAnno;

  const toggleIncassato = async (r: AltroIngresso) => {
    await fetch(`/api/altri-ingressi/${r.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incassato: !r.incassato }),
    });
    load();
  };

  const del = async (id: number) => {
    if (!confirm("Eliminare questo ingresso?")) return;
    await fetch(`/api/altri-ingressi/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-gray-500 text-sm">
          {filtered.length} voci
          {meseFiltro ? ` · ${MESI[meseFiltro - 1]}` : ""} · anno {anno}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={anno}
            onChange={(e) => setAnno(parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
          >
            {ANNI.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="glass-btn-primary flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Aggiungi Ingresso
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Totale {anno}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(totaleAnno)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Incassato
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#22c55e" }}>
            {fmt(incassatoAnno)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">
            Da incassare
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: "#f59e0b" }}>
            {fmt(daIncassareAnno)}
          </p>
        </div>
      </div>

      {/* Riepilogo mensile */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">
            Riepilogo altri ingressi mensili
          </h3>
          {meseFiltro !== null && (
            <button
              onClick={() => setMeseFiltro(null)}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium"
            >
              Rimuovi filtro mese
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
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Fonte",
                  "Descrizione",
                  "Mese",
                  "Anno",
                  "Importo",
                  "Incassato",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 ${h === "Importo" ? "text-right" : h === "Incassato" ? "text-center" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="zebra">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-gray-400 py-12 text-sm"
                  >
                    Nessun ingresso trovato
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {r.fonte}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {r.descrizione || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {MESI[r.mese - 1]}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.anno}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                    {fmt(r.importo)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleIncassato(r)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors"
                      style={
                        r.incassato
                          ? { background: "#dcfce7", color: "#166534" }
                          : { background: "#fef3c7", color: "#92400e" }
                      }
                    >
                      {r.incassato ? (
                        <>
                          <Check className="w-3 h-3" /> Incassato
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" /> In attesa
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditing(r);
                          setShowForm(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                        title="Modifica"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(r.id)}
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

      {showForm && (
        <AltroIngressoFormModal
          editing={editing}
          defaultAnno={anno}
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

// ─── Altro Ingresso Form Modal ─────────────────────────────────────────

function AltroIngressoFormModal({
  editing,
  defaultAnno,
  onClose,
  onSaved,
}: {
  editing: AltroIngresso | null;
  defaultAnno: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fonte: editing?.fonte ?? "",
    descrizione: editing?.descrizione ?? "",
    mese: editing?.mese ?? new Date().getMonth() + 1,
    anno: editing?.anno ?? defaultAnno,
    importo: editing ? String(editing.importo) : "",
    incassato: editing?.incassato ?? false,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.fonte.trim() || !form.importo) return;
    setSaving(true);
    try {
      const payload = {
        fonte: form.fonte.trim(),
        descrizione: form.descrizione || null,
        mese: form.mese,
        anno: form.anno,
        importo: parseFloat(form.importo) || 0,
        incassato: form.incassato,
      };
      if (editing) {
        await fetch(`/api/altri-ingressi/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/altri-ingressi", {
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
        className="glass-modal rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ textAlign: "left" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? "Modifica Ingresso" : "Nuovo Ingresso"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Fonte *
            </label>
            <input
              type="text"
              value={form.fonte}
              onChange={(e) =>
                setForm((f) => ({ ...f, fonte: e.target.value }))
              }
              placeholder="Es. Interessi bancari, Rimborso, Sponsorizzazione…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Descrizione
            </label>
            <input
              type="text"
              value={form.descrizione}
              onChange={(e) =>
                setForm((f) => ({ ...f, descrizione: e.target.value }))
              }
              placeholder="Note sulla voce"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Mese *
              </label>
              <select
                value={form.mese}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mese: parseInt(e.target.value) }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
              >
                {MESI.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Anno *
              </label>
              <select
                value={form.anno}
                onChange={(e) =>
                  setForm((f) => ({ ...f, anno: parseInt(e.target.value) }))
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
              >
                {ANNI.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Importo (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.importo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, importo: e.target.value }))
                }
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 text-right"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.incassato}
              onChange={(e) =>
                setForm((f) => ({ ...f, incassato: e.target.checked }))
              }
              className="w-4 h-4"
              style={{ accentColor: "#0ea5e9" }}
            />
            <span className="text-sm text-gray-700">Già incassato</span>
          </label>
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
            disabled={saving || !form.fonte.trim() || !form.importo}
            className="glass-btn-primary flex-1 text-white text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            {editing ? "Salva Modifiche" : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}
