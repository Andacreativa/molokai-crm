"use client";

import { ANNI } from "@/lib/constants";

interface Props {
  anno: number;
  onAnno: (a: number) => void;
  showAnno?: boolean;
  // Props legacy Anda (azienda/onAzienda/showAzienda/altroLabel/hideOptions)
  // non più usate: Molokai è azienda singola. Mantenute opzionali per
  // compatibilità con chiamate esistenti finché le pagine non sono rifatte.
  azienda?: string;
  onAzienda?: (a: string) => void;
  showAzienda?: boolean;
  altroLabel?: string;
  hideOptions?: string[];
}

export default function FiltriBar({ anno, onAnno, showAnno = true }: Props) {
  if (!showAnno) return null;
  return (
    <select
      value={anno}
      onChange={(e) => onAnno(parseInt(e.target.value))}
      className="text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 outline-none cursor-pointer appearance-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: "28px",
      }}
    >
      {ANNI.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}
