-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "paese" TEXT NOT NULL DEFAULT 'Italia',
    "email" TEXT,
    "telefono" TEXT,
    "partitaIva" TEXT,
    "indirizzo" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Fattura" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "descrizione" TEXT,
    "mese" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL DEFAULT 2025,
    "importo" REAL NOT NULL,
    "pagato" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fattura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Spesa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornitore" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descrizione" TEXT,
    "mese" INTEGER NOT NULL,
    "anno" INTEGER NOT NULL DEFAULT 2025,
    "importo" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
