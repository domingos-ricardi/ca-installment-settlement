import { NextResponse } from "next/server";

import { CaApiError } from "@/lib/contaazul/client";
import { listContasFinanceiras } from "@/lib/contaazul/endpoints";

export const dynamic = "force-dynamic";

/**
 * Lista as contas financeiras (contas bancárias) da empresa no Conta Azul.
 * Alimenta o dropdown da tela de importação.
 */
export async function GET() {
  try {
    const contas = await listContasFinanceiras();
    return NextResponse.json({ itens: contas });
  } catch (error) {
    if (error instanceof CaApiError && error.status === 401) {
      return NextResponse.json(
        { error: "Não autenticado na Conta Azul." },
        { status: 401 },
      );
    }
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
