import { z } from "zod";

import { NextResponse, type NextRequest } from "next/server";

import { CaApiError } from "@/lib/contaazul/client";
import { listarParcelasDoEvento, obterParcelaComEvento } from "@/lib/contaazul/endpoints";
import { dataReferenciaDoEvento } from "@/lib/contaazul/evento-normalize";
import type { ParcelaEvento } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Busca de parcelas: dado o id de um lançamento (parcela) selecionado no
 * dropdown, resolve o evento financeiro ao qual pertence e lista todas as
 * suas parcelas. Também devolve a data de referência (competência do evento,
 * com fallback para vencimentos) usada para filtrar as linhas do CSV.
 */

const querySchema = z.object({
  parcelaId: z.string().uuid("parcelaId deve ser um UUID"),
});

export async function GET(request: NextRequest) {
  const parcelaId = request.nextUrl.searchParams.get("parcelaId") ?? "";
  const parsed = querySchema.safeParse({ parcelaId });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.flatten().fieldErrors.parcelaId?.[0] ?? "Parâmetro inválido.",
      },
      { status: 400 },
    );
  }

  try {
    // 1. Resolve a parcela consultada e o evento ao qual pertence.
    const { evento, parcela } = await obterParcelaComEvento(parsed.data.parcelaId);
    if (!evento && !parcela) {
      return NextResponse.json(
        { error: "Parcela não encontrada na Conta Azul." },
        { status: 404 },
      );
    }

    // 2. Com o evento em mãos, lista todas as parcelas irmãs.
    let parcelas: ParcelaEvento[] = [];
    if (evento) {
      const resultado = await listarParcelasDoEvento(evento.id);
      parcelas = resultado.parcelas;
    }

    // 3. Data de referência do "dia do evento" para filtrar o CSV.
    const dataReferencia = dataReferenciaDoEvento(evento, [parcela, ...parcelas]);

    return NextResponse.json({
      evento,
      parcela_selecionada_id: parsed.data.parcelaId,
      parcelas,
      data_referencia: dataReferencia,
    });
  } catch (error) {
    if (error instanceof CaApiError && error.status === 401) {
      return NextResponse.json(
        { error: "Não autenticado na Conta Azul." },
        { status: 401 },
      );
    }
    if (error instanceof CaApiError && error.status === 429) {
      return NextResponse.json(
        { error: "Limite de requisições da Conta Azul atingido. Tente novamente." },
        { status: 429 },
      );
    }
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
