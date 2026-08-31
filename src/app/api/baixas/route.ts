import { z } from "zod";

import { NextResponse } from "next/server";

import { caConfig } from "@/lib/config";
import { CaApiError } from "@/lib/contaazul/client";
import { createBaixa } from "@/lib/contaazul/endpoints";
import type { BaixaResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Processa um lote de baixas sequencialmente (respeitando rate limit da API)
 * e devolve o resultado individual de cada item.
 */

const composicaoSchema = z.object({
  valor_bruto: z.number().nonnegative(),
  multa: z.number().nonnegative().optional(),
  juros: z.number().nonnegative().optional(),
  desconto: z.number().nonnegative().optional(),
  taxa: z.number().nonnegative().optional(),
});

const itemSchema = z.object({
  parcela_id: z.string().uuid("parcela_id deve ser um UUID"),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data_pagamento deve ser AAAA-MM-DD"),
  metodo_pagamento: z.string().optional(),
  observacao: z.string().optional(),
  nsu: z.string().optional(),
  composicao_valor: composicaoSchema,
});

const bodySchema = z.object({
  conta_financeira: z.string().uuid("conta_financeira deve ser um UUID"),
  items: z.array(itemSchema).min(1, "Envie ao menos uma baixa").max(1000),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { conta_financeira, items } = parsed.data;
  const results: BaixaResult[] = [];

  for (const [index, item] of items.entries()) {
    try {
      const data = await createBaixa(item.parcela_id, {
        data_pagamento: item.data_pagamento,
        composicao_valor: item.composicao_valor,
        conta_financeira,
        ...(item.metodo_pagamento ? { metodo_pagamento: item.metodo_pagamento } : {}),
        ...(item.observacao ? { observacao: item.observacao } : {}),
        ...(item.nsu ? { nsu: item.nsu } : {}),
      });
      results.push({
        index,
        parcela_id: item.parcela_id,
        success: true,
        status: 200,
        data,
      });
    } catch (error) {
      results.push({
        index,
        parcela_id: item.parcela_id,
        success: false,
        status: error instanceof CaApiError ? error.status : undefined,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao chamar a API Conta Azul.",
      });

      // Interrompe o lote em erros de autenticação/limite — não adianta insistir.
      if (error instanceof CaApiError && (error.status === 401 || error.status === 429)) {
        break;
      }
    }

    if (index < items.length - 1 && caConfig.baixasRequestDelayMs > 0) {
      await sleep(caConfig.baixasRequestDelayMs);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    total: items.length,
    processados: results.length,
    sucessos: successCount,
    falhas: results.length - successCount,
    interrompido: results.length < items.length,
    results,
  });
}
