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
};

const PAESE_MAP: Record<string, string> = {
  ITALIA: "Italia",
  SPAGNA: "Spagna",
  ALTRO: "Altro",
};

const SPESE_CSV = `Michele Stefanuto,FORNITORE,DICEMBRE,4502
Leonardo Mestre,STIPENDI,DICEMBRE,1586.7
Addebito Mensile Carta,CARTA AZIENDALE,DICEMBRE,100
Lorenzo Vanghetti,SOCI,DICEMBRE,500
Commissioni BBVA Cashback Tasse,COSTI BANCARI,DICEMBRE,11.4
Google,SOFTWARE,DICEMBRE,8.1
Seguridad Social,SEGURIDAD SOCIAL,NOVEMBRE,314
Caricamento Carta Aziendale,CARTA AZIENDALE,NOVEMBRE,300
Leonardo Mestre,STIPENDI,NOVEMBRE,1586.7
Michele Stefanuto,FORNITORE,NOVEMBRE,2082.08
Addebito Mensile Carta,CARTA AZIENDALE,NOVEMBRE,100
Commissioni BBVA Cashback Tasse,COSTI BANCARI,NOVEMBRE,11.4
Seguridad Social,SEGURIDAD SOCIAL,OTTOBRE,314
JOSE RAMON GARCIA / Quantum Business Advice S.L.,COMMERCIALISTA,OTTOBRE,150
Caricamento Carta Aziendale,CARTA AZIENDALE,OTTOBRE,200
Caricamento Carta Aziendale,CARTA AZIENDALE,OTTOBRE,500
Leonardo Mestre,STIPENDI,OTTOBRE,1586.7
Lorenzo Vanghetti,SOCI,OTTOBRE,300
Lorenzo Vanghetti,SOCI,SETTEMBRE,300
Lorenzo Vanghetti,SOCI,AGOSTO,300
Juri Valvasori,FORNITORE,OTTOBRE,1770
Seguridad Social,SEGURIDAD SOCIAL,SETTEMBRE,314
Commissioni BBVA Cashback Tasse,COSTI BANCARI,OTTOBRE,11.4
IONOS hosting,SOFTWARE,SETTEMBRE,10.98
Leonardo Mestre,STIPENDI,SETTEMBRE,1586.7
Commissioni BBVA Cashback Tasse,COSTI BANCARI,SETTEMBRE,11.4
IONOS hosting,SOFTWARE,AGOSTO,10.98
Seguridad Social,SEGURIDAD SOCIAL,AGOSTO,314
Leonardo Mestre,STIPENDI,AGOSTO,1586.7
Matteo Daneluzzi,SOCI,LUGLIO,560
IONOS hosting,SOFTWARE,LUGLIO,10.98
Seguridad Social,SEGURIDAD SOCIAL,LUGLIO,314
Leonardo Mestre,STIPENDI,LUGLIO,1586.7
JOSE RAMON GARCIA / Quantum Business Advice S.L.,COMMERCIALISTA,LUGLIO,300
Agencia Tributaria,TASSE,LUGLIO,581.79
Leonardo Mestre,STIPENDI,GIUGNO,1286.72
Revolut Business,COSTI BANCARI,GIUGNO,10
Seguridad Social,SEGURIDAD SOCIAL,GIUGNO,86.66
Cabify,CARTA AZIENDALE,GIUGNO,26.45
Poke Moana,CARTA AZIENDALE,GIUGNO,2
Cabify,CARTA AZIENDALE,GIUGNO,16.99
Nabucco Tiramisu,CARTA AZIENDALE,GIUGNO,5.8
Nabucco Tiramisu,CARTA AZIENDALE,GIUGNO,5.8
Mercadona Online,CARTA AZIENDALE,GIUGNO,65.58
Surfstatic Barcelona Sl,CARTA AZIENDALE,GIUGNO,43.65
La Roseta,CARTA AZIENDALE,GIUGNO,8.2
Leonardo Mestre,STIPENDI,GIUGNO,300
Brisa De Mar,CARTA AZIENDALE,GIUGNO,69.85
Cabify,CARTA AZIENDALE,GIUGNO,15.99
Squarespace,SOFTWARE,GIUGNO,25
Apricale Bellissimo,CARTA AZIENDALE,GIUGNO,5.9
Per Pebrots Fruits,CARTA AZIENDALE,GIUGNO,22
Matteo Daneluzzi,SOCI,MAGGIO,230
Pepa Tomate Gracia,CARTA AZIENDALE,MAGGIO,13
La Roseta,CARTA AZIENDALE,MAGGIO,8.2
Nabucco Tiramisu,CARTA AZIENDALE,MAGGIO,6.5
El Raim,CARTA AZIENDALE,MAGGIO,27.5
Cabify,CARTA AZIENDALE,MAGGIO,8.9
Cabify,CARTA AZIENDALE,MAGGIO,6.75
Amelie Restaurant,CARTA AZIENDALE,MAGGIO,27.7
Seguridad Social,SEGURIDAD SOCIAL,MAGGIO,86.66
Vermut Tapes El Rellot,CARTA AZIENDALE,MAGGIO,34.5
Las Euras - Bar Restaurant,CARTA AZIENDALE,MAGGIO,17.1
Leonardo Mestre,STIPENDI,MAGGIO,1586.7
Revolut Business,COSTI BANCARI,MAGGIO,10
Leonardo Mestre,STIPENDI,MAGGIO,800
.it - Italian Tradition,CARTA AZIENDALE,MAGGIO,36
Leonardo Mestre,STIPENDI,APRILE,1586.7
Faborit Rambla Catalunya,CARTA AZIENDALE,APRILE,7.1
Oldcoffe Sl,CARTA AZIENDALE,APRILE,7.5
Revolut Business,COSTI BANCARI,APRILE,10
Google,SOFTWARE,APRILE,6.9
Seguridad Social,SEGURIDAD SOCIAL,MARZO,86.66
Revolut Business,COSTI BANCARI,MARZO,10
Leonardo Mestre,STIPENDI,MARZO,800
Google,SOFTWARE,MARZO,6.9
Seguridad Social,SEGURIDAD SOCIAL,FEBBRAIO,86.66
Revolut Business,COSTI BANCARI,FEBBRAIO,10
Udemy,SOFTWARE,FEBBRAIO,132
SiteGround Hosting,SOFTWARE,FEBBRAIO,24.39
Google,SOFTWARE,FEBBRAIO,6.9
Leonardo Mestre,STIPENDI,FEBBRAIO,700
JOSE RAMON GARCIA / Quantum Business Advice S.L.,COMMERCIALISTA,GENNAIO,90
Seguridad Social,SEGURIDAD SOCIAL,GENNAIO,86.66
El Bandarra Taperia,CARTA AZIENDALE,GENNAIO,27.85
Revolut Business,COSTI BANCARI,GENNAIO,10
Google,CARTA AZIENDALE,GENNAIO,6.9`;

const ALTRI_CSV = `Chiosco Veliero,ITALIA,true,DICEMBRE,150
Cashback Tasse BBVA,SPAGNA,true,DICEMBRE,60
Cashback Tasse BBVA,SPAGNA,true,NOVEMBRE,60
Chiosco Veliero,ITALIA,true,OTTOBRE,150
Rara medicina estetica,ITALIA,true,SETTEMBRE,250
Rara medicina estetica,ITALIA,true,AGOSTO,250
Cashback Tasse BBVA,SPAGNA,true,OTTOBRE,60
Chiosco Veliero,ITALIA,true,SETTEMBRE,150
Cashback Tasse BBVA,SPAGNA,true,SETTEMBRE,60
Chez Tobs,ITALIA,true,SETTEMBRE,150
Chiosco Veliero,ITALIA,true,AGOSTO,200
Chiosco Veliero,ITALIA,true,LUGLIO,240
Lorenzo Vanghetti,ITALIA,true,GIUGNO,150
Chez Tobs,ITALIA,true,MAGGIO,150
ECMC,ALTRO,true,MAGGIO,200
Matteo Daneluzzi,ITALIA,true,FEBBRAIO,50
Maicol Arman,ITALIA,true,FEBBRAIO,50`;

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
        anno: 2025,
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
        anno: 2025,
        importo: parseFloat(importoRaw),
        incassato,
        dataIncasso: incassato ? new Date(2025, mese - 1, 15) : null,
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
    `✓ Inserite ${speseRows.length} spese 2025 (totale €${totSpese.toFixed(2)})`,
  );
  console.log(
    `✓ Inseriti ${altriRows.length} altri ingressi 2025 (totale €${totAltri.toFixed(2)})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
