// Simula l'import Google Form CSV usando la stessa logica del modal
// (parsing, dedup nome+cognome+email, anteprima Verde/Giallo).
// NON importa nel DB: solo anteprima per validare la pipeline.
//
// Uso: npx tsx scripts/test-google-form-import.ts [path-csv]

import "dotenv/config";
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

const path =
  process.argv[2] ||
  "/Users/b16451536/Downloads/CLUB MEMBER FORM - MOLOKAI SUP CENTER.csv";

const pickField = (
  row: Record<string, unknown>,
  ...keys: string[]
): string => {
  const norm = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  for (const k of keys) {
    const v = norm[k.toLowerCase().trim()];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
};

function parsePiano(raw: string): { piano: string; prezzoPiano: number } {
  const parts = raw.split(/[-–—]/);
  const namePart = (parts[0] ?? "").trim();
  const pricePart = (parts.slice(1).join("-") ?? "").trim();
  const cleaned = pricePart.replace(/[€\s]/g, "").replace(",", ".");
  const prezzoPiano = parseFloat(cleaned) || 0;
  const lower = namePart.toLowerCase();
  let piano: string;
  if (lower.includes("anual") || lower.includes("annuale")) piano = "ANNUALE";
  else if (lower.includes("varada")) piano = "PLAN VARADA";
  else if (lower.includes("material")) piano = "PLAN MATERIAL";
  else piano = namePart.toUpperCase() || "ALTRO";
  return { piano, prezzoPiano };
}

function parsePagamento(raw: string): "MENSILE" | "ANNUALE" {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("anual") || lower.includes("annual")) return "ANNUALE";
  return "MENSILE";
}

function splitName(full: string): { nome: string; cognome: string } {
  const tokens = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { nome: "", cognome: "" };
  if (tokens.length === 1) return { nome: tokens[0], cognome: "" };
  return { nome: tokens[0], cognome: tokens.slice(1).join(" ") };
}

const fullNameKey = (n: string, c: string) =>
  `${n.toLowerCase().trim()}|${c.toLowerCase().trim()}`;

async function main() {
  console.log(`\n📂  Parsing: ${path}\n`);

  const buf = readFileSync(path);
  const isCsv = /\.csv$/i.test(path);
  const wb = isCsv
    ? XLSX.read(buf.toString("utf-8"), { type: "string", cellDates: true })
    : XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
  });

  const existingSoci = await prisma.socio.findMany({
    select: { nome: true, cognome: true, email: true },
  });
  const existingEmails = new Set(
    existingSoci
      .map((s) => (s.email ?? "").toLowerCase().trim())
      .filter(Boolean),
  );
  const existingNames = new Set(
    existingSoci
      .map((s) => fullNameKey(s.nome ?? "", s.cognome ?? ""))
      .filter((k) => k !== "|"),
  );

  console.log(
    `Soci esistenti nel DB: ${existingSoci.length} (${existingEmails.size} con email)\n`,
  );

  console.log(
    `${"#".padStart(2)}  ${"Stato".padEnd(14)} ${"Nome".padEnd(12)} ${"Cognome".padEnd(15)} ${"Piano".padEnd(15)} ${"€".padStart(7)} ${"Pag.".padEnd(8)} email`,
  );
  console.log("─".repeat(120));

  let nuovi = 0;
  let dupEmail = 0;
  let dupNome = 0;

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const email = pickField(
      r,
      "Nome utente",
      "Email",
      "email",
    ).toLowerCase();
    const fullName = pickField(r, "Nombre y Apellido", "Nombre", "Nome");
    const pianoRaw = pickField(r, "Tipo de Plan", "Tipo Plan", "Plan");
    const pagamentoRaw = pickField(
      r,
      "Método de Pago",
      "Metodo de Pago",
    );
    if (!fullName && !email) continue;

    const { piano, prezzoPiano } = parsePiano(pianoRaw);
    const { nome, cognome } = splitName(fullName);
    const dupByEmail =
      email && existingEmails.has(email.toLowerCase().trim());
    const dupByName =
      nome && existingNames.has(fullNameKey(nome, cognome));

    let stato: string;
    let icon: string;
    if (dupByEmail) {
      stato = "DUP email";
      icon = "🟡";
      dupEmail++;
    } else if (dupByName) {
      stato = "DUP nome";
      icon = "🟡";
      dupNome++;
    } else {
      stato = "Nuovo";
      icon = "🟢";
      nuovi++;
    }
    const pag = parsePagamento(pagamentoRaw);
    console.log(
      `${String(i + 1).padStart(2)}  ${icon} ${stato.padEnd(11)} ${nome.padEnd(12)} ${cognome.padEnd(15)} ${piano.padEnd(15)} €${prezzoPiano.toFixed(2).padStart(6)} ${pag.padEnd(8)} ${email}`,
    );
  }

  console.log("─".repeat(120));
  console.log(`\nRiepilogo:`);
  console.log(`  🟢 Nuovi (importabili)         : ${nuovi}`);
  console.log(`  🟡 Duplicati per email         : ${dupEmail}`);
  console.log(`  🟡 Duplicati per nome+cognome  : ${dupNome}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Totale righe parsate          : ${nuovi + dupEmail + dupNome}\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
