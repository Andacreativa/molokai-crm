import { prisma } from "../lib/prisma";

const MESI_MAP: Record<string, number> = {
  GENNAIO: 1,
  FEBBRAIO: 2,
  MARZO: 3,
  APRILE: 4,
  MAGGIO: 5,
  GIUGNO: 6,
  LUGLIO: 7,
  AGOSTO: 8,
  SETTEMBRE: 9,
  OTTOBRE: 10,
  NOVEMBRE: 11,
  DICEMBRE: 12,
};

const CATEGORIA_MAP: Record<string, string> = {
  FORNITORE: "Fornitori",
  STIPENDI: "Stipendio",
  "CARTA AZIENDALE": "Carta Aziendale",
  SOCI: "Soci",
  "COSTI BANCARI": "Costi Bancari",
  SOFTWARE: "Software",
  "SEGURIDAD SOCIAL": "Seguridad Social",
  COMMERCIALISTA: "Commercialista",
  TASSE: "Tasse",
  NOTAIO: "Altro",
};

const PAESE_MAP: Record<string, string> = {
  ITALIA: "Italia",
  SPAGNA: "Spagna",
  ALTRO: "Altro",
};

const SPESE_CSV = `Notaio,NOTAIO,APRILE,623.26
Spese Carta Azienda,CARTA AZIENDALE,APRILE,40
Google,SOFTWARE,MAGGIO,6.67
Spese Carta Azienda,CARTA AZIENDALE,MAGGIO,17.59
Google,SOFTWARE,GIUGNO,6.9
Spese Carta Azienda,CARTA AZIENDALE,GIUGNO,15
Google,SOFTWARE,LUGLIO,6.9
Spese Carta Azienda,CARTA AZIENDALE,LUGLIO,40.52
Leonardo Mestre,STIPENDI,LUGLIO,1586.7
Seguridad Social,SEGURIDAD SOCIAL,LUGLIO,86.66
Revolut Business,COSTI BANCARI,LUGLIO,5.92
Google,SOFTWARE,AGOSTO,6.9
Seguridad Social,SEGURIDAD SOCIAL,AGOSTO,86.66
Google,SOFTWARE,SETTEMBRE,6.9
Spese Carta Azienda,CARTA AZIENDALE,SETTEMBRE,19
Leonardo Mestre,STIPENDI,SETTEMBRE,1100
Seguridad Social,SEGURIDAD SOCIAL,SETTEMBRE,86.66
Revolut Business,COSTI BANCARI,SETTEMBRE,10
Google,SOFTWARE,OTTOBRE,6.9
Spese Carta Azienda,CARTA AZIENDALE,OTTOBRE,41.69
Leonardo Mestre,STIPENDI,OTTOBRE,1000
Google,SOFTWARE,NOVEMBRE,6.9
Spese Carta Azienda,CARTA AZIENDALE,NOVEMBRE,45.08
Seguridad Social,SEGURIDAD SOCIAL,NOVEMBRE,86.66
Revolut Business,COSTI BANCARI,NOVEMBRE,10
Google,SOFTWARE,DICEMBRE,6.9
Leonardo Mestre,STIPENDI,DICEMBRE,700
Revolut Business,COSTI BANCARI,DICEMBRE,10
Seguridad Social,SEGURIDAD SOCIAL,DICEMBRE,86.66`;

const ALTRI_CSV = `Socio,SPAGNA,true,APRILE,850
Paypal,SPAGNA,true,GIUGNO,400
Paypal,SPAGNA,true,OTTOBRE,200
Socio,SPAGNA,true,OTTOBRE,450
Paypal,SPAGNA,true,DICEMBRE,200`;

async function main() {
  const speseRows = SPESE_CSV.trim()
    .split("\n")
    .map((line) => {
      const [fornitore, catRaw, meseRaw, importoRaw] = line.split(",");
      const categoria = CATEGORIA_MAP[catRaw.trim()];
      const mese = MESI_MAP[meseRaw.trim()];
      if (!categoria) throw new Error(`Categoria sconosciuta: ${catRaw}`);
      if (!mese) throw new Error(`Mese sconosciuto: ${meseRaw}`);
      return {
        fornitore: fornitore.trim(),
        categoria,
        mese,
        anno: 2024,
        azienda: "Spagna",
        importo: parseFloat(importoRaw),
      };
    });

  const altriRows = ALTRI_CSV.trim()
    .split("\n")
    .map((line) => {
      const [cliente, paeseRaw, pagatoRaw, meseRaw, importoRaw] =
        line.split(",");
      const azienda = PAESE_MAP[paeseRaw.trim()];
      const mese = MESI_MAP[meseRaw.trim()];
      if (!azienda) throw new Error(`Paese sconosciuto: ${paeseRaw}`);
      if (!mese) throw new Error(`Mese sconosciuto: ${meseRaw}`);
      const incassato = pagatoRaw.trim().toLowerCase() === "true";
      return {
        fonte: cliente.trim(),
        azienda,
        mese,
        anno: 2024,
        importo: parseFloat(importoRaw),
        incassato,
        dataIncasso: incassato ? new Date(2024, mese - 1, 15) : null,
      };
    });

  console.log(
    `Da inserire: ${speseRows.length} spese + ${altriRows.length} altri ingressi\n`,
  );

  await prisma.spesa.createMany({ data: speseRows });
  await prisma.altroIngresso.createMany({ data: altriRows });

  const totSpese = speseRows.reduce((s, r) => s + r.importo, 0);
  const totAltri = altriRows.reduce((s, r) => s + r.importo, 0);
  console.log(
    `✓ Inserite ${speseRows.length} spese 2024 (totale €${totSpese.toFixed(2)})`,
  );
  console.log(
    `✓ Inseriti ${altriRows.length} altri ingressi 2024 (totale €${totAltri.toFixed(2)})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
