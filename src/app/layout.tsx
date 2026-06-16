import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AlCheque — Gestión de Centro Terapéutico",
    template: "%s | AlCheque",
  },
  description:
    "Sistema de gestión financiera para centros terapéuticos. Controla ingresos, egresos, pacientes y genera reportes en Lempiras (HNL).",
  keywords: ["centro terapéutico", "gestión", "finanzas", "Honduras", "HNL"],
  robots: "noindex,nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={manrope.variable} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
