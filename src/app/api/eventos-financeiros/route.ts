import { z } from "zod";

import { NextResponse, type NextRequest } from "next/server";

import { CaApiError } from "@/lib/contaazul/client";
import { buscarLancamentos } from "@/lib/contaazul/endpoints";

export const dynamic = "force-dynamic";

/**
 * Lista lançamentos financeiros (contas a receber/pagar) por faixa de
 * vencimento. Alimenta o dropdown de Evento Financeiro da tela.
 *
 * A API do Conta Azul não expõe listagem direta de "eventos": a busca oficial
 * retorna parcelas com dados resumidos, suficiente para o usuário identificar
 * o lançamento desejado (descrição, vencimento, valor e status).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
  tipo: z.enum(["RECEITA", "DESPESA"]).default("RECEITA"),
  de: z.string().regex(ISO_DATE, "'de' deve ser AAAA-MM-DD"),
  ate: z.string().regex(ISO_DATE, "'ate' deve ser AAAA-MM-DD"),
  emAberto: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  pagina: z.coerce.number().int().positive().default(1),
});

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    tipo: params.get("tipo") ?? undefined,
    de: params.get("de") ?? undefined,
    ate: params.get("ate") ?? undefined,
    emAberto: params.get("emAberto") ?? undefined,
    pagina: params.get("pagina") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tipo, de, ate, emAberto, pagina } = parsed.data;

  try {
    const page = await buscarLancamentos({
      tipo,
      dataVencimentoDe: de,
      dataVencimentoAte: ate,
      apenasEmAberto: emAberto,
      pagina,
    });
    return NextResponse.json({
      itens_totais: page.itensTotais,
      itens: page.itens,
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
