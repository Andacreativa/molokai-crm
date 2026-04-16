-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Fattura" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "azienda" TEXT NOT NULL DEFAULT 'Anda Spagna',
    "descrizione" TEXT,
    "mese" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL DEFAULT 2025,
    "importo" REAL NOT NULL,
    "pagato" BOOLEAN NOT NULL DEFAULT false,
    "scadenza" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fattura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Fattura" ("anno", "clienteId", "createdAt", "descrizione", "id", "importo", "mese", "pagato") SELECT "anno", "clienteId", "createdAt", "descrizione", "id", "importo", "mese", "pagato" FROM "Fattura";
DROP TABLE "Fattura";
ALTER TABLE "new_Fattura" RENAME TO "Fattura";
CREATE TABLE "new_Spesa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "azienda" TEXT NOT NULL DEFAULT 'Anda Spagna',
    "fornitore" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descrizione" TEXT,
    "note" TEXT,
    "ricevutaPath" TEXT,
    "mese" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL DEFAULT 2025,
    "importo" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Spesa" ("anno", "categoria", "createdAt", "descrizione", "fornitore", "id", "importo", "mese") SELECT "anno", "categoria", "createdAt", "descrizione", "fornitore", "id", "importo", "mese" FROM "Spesa";
DROP TABLE "Spesa";
ALTER TABLE "new_Spesa" RENAME TO "Spesa";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
