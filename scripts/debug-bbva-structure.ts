import { readFileSync } from "fs";
import * as XLSX from "xlsx";
const path =
  process.argv[2] ||
  "/Users/b16451536/Downloads/BBVA Histórico movimientos (1).xlsx";
const wb = XLSX.read(readFileSync(path), {
  type: "buffer",
  cellDates: true,
});
console.log("SheetNames:", wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws["!ref"];
  console.log(`\n=== ${name} (range: ${ref}) ===`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });
  for (let i = 0; i < Math.min(rows.length, 22); i++) {
    console.log(`R${i}: ${JSON.stringify(rows[i])}`);
  }
  console.log(`Total rows: ${rows.length}`);
}
