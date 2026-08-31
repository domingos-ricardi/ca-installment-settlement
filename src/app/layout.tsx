import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Importador de Baixas · Conta Azul",
  description:
    "Importe baixas em lote na Conta Azul a partir de arquivos CSV.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
