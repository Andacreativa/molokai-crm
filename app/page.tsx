"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendingUp, Wallet } from "lucide-react";

export default function LandingPage() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 50);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 1600);
    const t4 = setTimeout(() => setPhase(4), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-16 relative"
      style={{ background: "#1c1c1e" }}
    >
      <h1
        className={`text-6xl font-bold text-white tracking-tight transition-all duration-700 ${
          phase >= 2 ? "-translate-y-10" : "translate-y-0"
        } ${phase >= 1 ? "opacity-100" : "opacity-0"}`}
      >
        WakeUP! Labs España
      </h1>

      <div className="flex gap-14">
        {/* Finance */}
        <Link
          href="/finance"
          className={`flex flex-col items-center gap-5 group outline-none transition-all duration-700 ${
            phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-105"
            style={{
              background: "rgba(232,48,138,0.12)",
              border: "1.5px solid rgba(232,48,138,0.35)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow:
                "0 1px 0 0 rgba(255,180,220,0.15) inset, 0 8px 32px rgba(232,48,138,0.2)",
            }}
          >
            <Wallet size={52} color="#e8308a" />
          </div>
          <span className="text-white text-sm font-semibold tracking-wide">
            Finance
          </span>
        </Link>

        {/* Sales */}
        <Link
          href="/sales"
          className={`flex flex-col items-center gap-5 group outline-none transition-all duration-700 ${
            phase >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-105"
            style={{
              background: "rgba(219,41,27,0.12)",
              border: "1.5px solid rgba(219,41,27,0.35)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow:
                "0 1px 0 0 rgba(255,120,100,0.15) inset, 0 8px 32px rgba(219,41,27,0.2)",
            }}
          >
            <TrendingUp size={52} color="#db291b" />
          </div>
          <span className="text-white text-sm font-semibold tracking-wide">
            Sales
          </span>
        </Link>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-10 opacity-70">
        <img
          src="/logo anda.png"
          alt="Anda"
          className="h-20"
          style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
        <img
          src="/WAKE UP! labs - LOGO.png"
          alt="Wake Up Labs"
          className="h-16"
          style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      </div>
    </div>
  );
}
