"use client";

// Palette di colori HSL deterministica — colori saturi ma leggibili con testo bianco.
const HUE_STEPS = [
  210, 30, 150, 280, 0, 195, 45, 130, 260, 340, 175, 100, 60, 320, 245,
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarColor(seed: string): string {
  const idx = hashString(seed) % HUE_STEPS.length;
  return `hsl(${HUE_STEPS[idx]}, 55%, 50%)`;
}

export function initials(nome: string, cognome?: string | null): string {
  const a = (nome ?? "").trim();
  const b = (cognome ?? "").trim();
  const ai = a ? a[0]!.toUpperCase() : "";
  const bi = b ? b[0]!.toUpperCase() : "";
  if (ai && bi) return ai + bi;
  if (ai) {
    // se cognome assente, prova seconda parte di nome (es. "Leonardo Mestre")
    const parts = a.split(/\s+/).filter(Boolean);
    if (parts.length > 1)
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    return ai;
  }
  return "?";
}

interface Props {
  nome: string;
  cognome?: string | null;
  fotoPath?: string | null;
  size?: number; // px
  className?: string;
}

export default function Avatar({
  nome,
  cognome,
  fotoPath,
  size = 40,
  className,
}: Props) {
  const seed = `${nome ?? ""}|${cognome ?? ""}`;
  const bg = avatarColor(seed);
  const text = initials(nome, cognome);
  const dim = `${size}px`;

  if (fotoPath) {
    return (
      <span
        className={`inline-block rounded-full overflow-hidden bg-gray-100 ${className ?? ""}`}
        style={{ width: dim, height: dim }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotoPath}
          alt={`${nome} ${cognome ?? ""}`.trim()}
          className="w-full h-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white select-none ${className ?? ""}`}
      style={{
        width: dim,
        height: dim,
        background: bg,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {text}
    </span>
  );
}
