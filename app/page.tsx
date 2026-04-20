"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 50);
    const t2 = setTimeout(() => setPhase(2), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-16"
      style={{ background: "#1c1c1e" }}
    >
      <div
        className={`flex flex-col items-center gap-6 transition-all duration-700 ${
          phase >= 1 ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          src="/logo-molokai.png"
          alt="Molokai logo"
          className="w-40 h-40"
          style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
        <h1 className="text-6xl font-bold text-white tracking-tight">
          CRM Molokai
        </h1>
      </div>

      <Link
        href="/finance"
        className={`group outline-none transition-all duration-700 ${
          phase >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div
          className="w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-105"
          style={{
            background: "rgba(14,165,233,0.12)",
            border: "1.5px solid rgba(14,165,233,0.35)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "0 1px 0 0 rgba(186,230,253,0.15) inset, 0 8px 32px rgba(14,165,233,0.2)",
          }}
        >
          <span
            className="text-lg font-bold tracking-[0.25em] uppercase"
            style={{ color: "#0ea5e9" }}
          >
            Start
          </span>
        </div>
      </Link>
    </div>
  );
}
