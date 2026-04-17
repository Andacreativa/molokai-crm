"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { ANNI } from "./constants";

interface AnnoCtx {
  anno: number;
  setAnno: (a: number) => void;
}

const AnnoContext = createContext<AnnoCtx>({
  anno: ANNI[0],
  setAnno: () => {},
});

export function AnnoProvider({ children }: { children: ReactNode }) {
  const [anno, setAnnoState] = useState(ANNI[0]);

  // Al primo mount legge da localStorage, altrimenti usa il primo anno della lista
  useEffect(() => {
    const saved = localStorage.getItem("lf_anno");
    if (saved) {
      const n = parseInt(saved);
      if (ANNI.includes(n)) setAnnoState(n);
    }
  }, []);

  const setAnno = (a: number) => {
    setAnnoState(a);
    localStorage.setItem("lf_anno", String(a));
  };

  return (
    <AnnoContext.Provider value={{ anno, setAnno }}>
      {children}
    </AnnoContext.Provider>
  );
}

export const useAnno = () => useContext(AnnoContext);
