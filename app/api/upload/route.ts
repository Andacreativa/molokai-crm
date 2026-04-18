import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const subdirRaw = (formData.get("subdir") as string | null) || "ricevute";
  const subdir = subdirRaw.replace(/[^a-z0-9_-]/gi, "") || "ricevute";

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "public", subdir);
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({ path: `/${subdir}/${filename}` });
}
