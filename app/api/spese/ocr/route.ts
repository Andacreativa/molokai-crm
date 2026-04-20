import { NextResponse } from "next/server";

// OCR scontrino/fattura via Claude API (vision + PDF support).
// Riceve multipart/form-data con `file` (immagine o PDF), ritorna JSON estratto.

const MODEL = "claude-sonnet-4-20250514";
const SYSTEM_PROMPT = `Estrai i dati da questo scontrino/fattura e rispondi SOLO in JSON: {fornitore, importo, data (formato YYYY-MM-DD), categoria (una tra: Scuola|Rappresentanza|Materiale Sportivo|Affitto|Utenze|Marketing|Assicurazione|Commercialista|Tasse|Altro), descrizione}`;

function jsonFromResponse(text: string): Record<string, unknown> | null {
  // Cerca il primo blocco JSON nel testo (supporta fence markdown o plain)
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();
  // Trova la prima { e l'ultima } per estrarre l'oggetto
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY non configurata nel .env. Aggiungi la chiave API Anthropic per abilitare l'OCR automatico.",
      },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File mancante" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const mime = file.type || "application/octet-stream";
  const isPDF = mime === "application/pdf" || /\.pdf$/i.test(file.name);

  const contentBlock = isPDF
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf",
          data: base64,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mime,
          data: base64,
        },
      };

  const payload = {
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [contentBlock, { type: "text", text: "Estrai i dati." }],
      },
    ],
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Claude API ${res.status}: ${errText}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    // Estrai il testo dalla prima content block
    const text: string =
      data?.content?.[0]?.type === "text" ? data.content[0].text : "";
    const extracted = jsonFromResponse(text);

    if (!extracted) {
      return NextResponse.json(
        { error: "Risposta non parseable", rawText: text },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: extracted });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
