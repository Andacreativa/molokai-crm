export const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export const CATEGORIE_SPESA = [
  'Stipendio',
  'Seguridad Social',
  'Tasse',
  'Carta Aziendale',
  'Costi Aziendali',
  'Software',
  'Commercialista',
  'Fornitori',
  'Soci',
  'Costi Bancari',
  'Altro',
]

export const AZIENDE = ['Spagna', 'Italia', 'Altro']

export const AZIENDA_COLORI: Record<string, { bg: string; text: string; border: string }> = {
  'Spagna': { bg: '#ef4444', text: '#ffffff', border: '#ef4444' },
  'Italia': { bg: '#22c55e', text: '#ffffff', border: '#22c55e' },
  'Altro':  { bg: '#f8f9fc', text: '#64748b', border: '#e2e8f0' },
}

export const PAESI = [
  'Italia',
  'Spagna',
  'Francia',
  'Germania',
  'Portogallo',
  'Regno Unito',
  'Altro',
]

export const CATEGORIE_COLORI: Record<string, string> = {
  'Stipendio': '#e8308a',
  'Seguridad Social': '#8b5cf6',
  'Tasse': '#ef4444',
  'Carta Aziendale': '#f59e0b',
  'Costi Aziendali': '#10b981',
  'Software': '#06b6d4',
  'Commercialista': '#f97316',
  'Fornitori': '#3b82f6',
  'Soci': '#ec4899',
  'Costi Bancari': '#64748b',
  'Altro': '#94a3b8',
}

export const BRAND = '#e8308a'

export function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
}

// Genera anni in ordine decrescente a partire dall'anno corrente
const ANNO_CORRENTE = new Date().getFullYear()
export const ANNI = Array.from({ length: 5 }, (_, i) => ANNO_CORRENTE - i) // es. 2026,2025,2024,2023,2022
