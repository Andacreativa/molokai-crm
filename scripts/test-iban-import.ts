// Verifica la pipeline IBAN del modal Google Form Import:
// 1. legge il CSV con xlsx
// 2. estrae "Introduce tu IBAN" via pickField (case-insensitive)
// 3. normalizza (uppercase + spazi)
// 4. mostra cosa verrebbe inviato a POST /api/club/soci
// 5. fa una POST reale e verifica che l'iban sia salvato nel DB
//
// Uso: npx tsx scripts/test-iban-import.ts [path-csv]

import "dotenv/config";
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { prisma } from "../lib/prisma";

const path = process.argv[2] || null;

// Sample CSV che riproduce il formato Google Form Molokai (3 righe di test).
// Le virgole interne ai prezzi richiedono quoting con "..."  come fa Google
// Sheets quando esporta CSV.
const SAMPLE_CSV = `Informazioni cronologiche,Nome utente,Nombre y Apellido,Tipo de Plan,Método de Pago,Introduce tu IBAN,Introduce tu DNI/NIE,Introduce tu número de móvil
2026-04-29 10:00:00,test1@molokai.es,Mario Rossi Verdi,"Plan Varada - 60,00 €",Mensual,es91 2100 0418 4502 0005 1332,X9876543K,+34 600 111 222
2026-04-29 11:00:00,test2@molokai.es,Anna Bianchi,"Plan Anual - 648,00 €",Anual,ES7620770024003102575766,12345678A,600333444
2026-04-29 12:00:00,test3@molokai.es,Luigi De Luca,"Plan Material - 55,00 €",Mensual,,Y0011223A,+34 612 345 678`;

const pickField = (row: Record<string, unknown>, ...keys: string[]): string => {
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

const splitName = (full: string) => {
  const tokens = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { nome: "", cognome: "" };
  if (tokens.length === 1) return { nome: tokens[0], cognome: "" };
  return { nome: tokens[0], cognome: tokens.slice(1).join(" ") };
};

async function main() {
  let csvText: string;
  if (path) {
    console.log(`\n📂  Parsing: ${path}\n`);
    csvText = readFileSync(path).toString("utf-8");
  } else {
    console.log(`\n📂  Sample inline CSV (formato Google Form Molokai)\n`);
    csvText = SAMPLE_CSV;
  }
  const wb = XLSX.read(csvText, {
    type: "string",
    cellDates: true,
  });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    raw: false,
    dateNF: "yyyy-mm-dd",
    defval: "",
  });

  console.log(`Header del CSV (primi nomi colonna):`);
  if (rows.length > 0) {
    Object.keys(rows[0]).forEach((k) => console.log(`  · "${k}"`));
  }
  console.log();

  console.log(`═══ Estrazione IBAN per ogni riga ═══\n`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fullName = pickField(r, "Nombre y Apellido", "Nombre", "Nome");
    const { nome, cognome } = splitName(fullName);
    const ibanRaw = pickField(r, "Introduce tu IBAN", "IBAN", "iban");
    const ibanNormalized = ibanRaw.toUpperCase().replace(/\s+/g, " ").trim();
    console.log(
      `  Riga ${i + 1}: ${(nome + " " + cognome).padEnd(30)} IBAN raw="${ibanRaw}"  →  normalized="${ibanNormalized}"`,
    );
  }
  console.log();

  // Pick first row with non-empty IBAN as test sample
  const firstWithIban = rows.find(
    (r) => pickField(r, "Introduce tu IBAN", "IBAN", "iban") !== "",
  );
  if (!firstWithIban) {
    console.log("Nessuna riga con IBAN nel CSV — skip test POST.");
    return;
  }

  const fullName = pickField(
    firstWithIban,
    "Nombre y Apellido",
    "Nombre",
    "Nome",
  );
  const { nome, cognome } = splitName(fullName);
  const ibanRaw = pickField(firstWithIban, "Introduce tu IBAN", "IBAN", "iban");
  const iban = ibanRaw.toUpperCase().replace(/\s+/g, " ").trim();

  // Test direct DB insert (bypass auth) per verificare che il campo iban sia
  // accettato dal model e salvato correttamente.
  console.log(`═══ Test creazione socio (riga IBAN reale) ═══\n`);
  const testSocio = await prisma.socio.create({
    data: {
      nome: `_TEST_${nome}`,
      cognome: cognome || null,
      piano: "PLAN VARADA",
      prezzoPiano: 60,
      pagamento: "MENSILE",
      stato: "ATTIVO",
      matricola: `_TEST_${Date.now()}`,
      iban,
    },
  });
  console.log(`  ✓ Socio creato id=${testSocio.id}`);
  console.log(`     nome:    ${testSocio.nome}`);
  console.log(`     cognome: ${testSocio.cognome ?? "—"}`);
  console.log(`     iban (in DB): "${testSocio.iban}"`);
  console.log(`     iban valore atteso: "${iban}"`);
  console.log(`     ✅ MATCH: ${testSocio.iban === iban}`);

  // Cleanup
  await prisma.socio.delete({ where: { id: testSocio.id } });
  console.log(`\n  ⊗ Socio test eliminato\n`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e);
    await prisma.$disconnect();
    process.exit(1);
  });
