import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "CRM Molokai",
  description: "Gestionale Interno — Molokai Experience SL",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${roboto.variable} h-full antialiased`}>
      <body className="font-[family-name:var(--font-roboto)]">{children}</body>
    </html>
  );
}
