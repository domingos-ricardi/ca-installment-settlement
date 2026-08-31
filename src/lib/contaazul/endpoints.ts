import "server-only";

import { caConfig } from "@/lib/config";
import { caFetch } from "@/lib/contaazul/client";
import {
  normalizeLancamentos,
  normalizeParcelaUnica,
  normalizeParcelasDoEvento,
} from "@/lib/contaazul/evento-normalize";
import type {
  BaixaPayload,
  ContaFinanceira,
  EventoFinanceiro,
  EventoTipo,
  LancamentoResumo,
  ParcelaEvento,
} from "@/lib/types";

/**
 * Funções de domínio para os endpoints da API v2 do Conta Azul usados neste app.
 */

interface ContasFinanceirasApiResponse {
  itens_totais?: number;
  itens?: ContaFinanceira[];
  items?: ContaFinanceira[];
}

/**
 * Lista as contas financeiras (contas bancárias/caixa) da empresa.
 * Pagina automaticamente até esgotar ou atingir o limite de segurança.
 */
export async function listContasFinanceiras(): Promise<ContaFinanceira[]> {
  const pageSize = caConfig.contasFinanceirasPageSize;
  const all: ContaFinanceira[] = [];
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page++) {
    const query = new URLSearchParams({
      pagina: String(page),
      tamanho_pagina: String(pageSize),
      apenas_ativo: "true",
    });

    const data = await caFetch<ContasFinanceirasApiResponse>(
      `/v1/conta-financeira?${query.toString()}`,
    );

    // A API usa "itens"; mantemos fallback "items" por robustez.
    const batch = data.itens ?? data.items ?? [];
    all.push(...batch);

    const total = data.itens_totais ?? all.length;
    if (all.length >= total || batch.length === 0) break;
  }

  return all;
}

/** Resposta esperada ao criar uma baixa. */
export interface BaixaResponse {
  id?: string;
  versao?: number;
  [key: string]: unknown;
}

/**
 * Registra a baixa (quitação) de uma parcela.
 * POST /v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa
 */
export async function createBaixa(
  parcelaId: string,
  payload: Omit<BaixaPayload, "parcela_id">,
): Promise<BaixaResponse> {
  return caFetch<BaixaResponse>(
    `/v1/financeiro/eventos-financeiros/parcelas/${encodeURIComponent(parcelaId)}/baixa`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Eventos financeiros e suas parcelas                                        */
/* -------------------------------------------------------------------------- */

/** A API só aceita estes tamanhos de página (documentação oficial). */
const PAGE_SIZES = [10, 20, 50, 100, 200, 500, 1000] as const;

const BUSCAR_PATHS: Record<EventoTipo, string> = {
  RECEITA:
    "/v1/financeiro/eventos-financeiros/contas-a-receber/buscar",
  DESPESA:
    "/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar",
};

export interface BuscarLancamentosArgs {
  tipo: EventoTipo;
  /** Faixa obrigatória de vencimento (AAAA-MM-DD), exigida pela API. */
  dataVencimentoDe: string;
  dataVencimentoAte: string;
  /** Quando `true`, filtra apenas parcelas EM_ABERTO. */
  apenasEmAberto: boolean;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface LancamentosPage {
  itensTotais: number;
  itens: LancamentoResumo[];
}

/**
 * Busca lançamentos (contas a receber/pagar) por faixa de vencimento.
 * GET /v1/financeiro/eventos-financeiros/contas-a-{receber,pagar}/buscar
 */
export async function buscarLancamentos(
  args: BuscarLancamentosArgs,
): Promise<LancamentosPage> {
  const pagina = Math.max(1, Math.trunc(args.pagina ?? 1));
  const solicitado = Math.trunc(args.tamanhoPagina ?? caConfig.eventosFinanceirosPageSize);
  const tamanhoPagina =
    (PAGE_SIZES as readonly number[]).find((size) => size >= solicitado) ?? 1000;

  const query = new URLSearchParams({
    pagina: String(pagina),
    tamanho_pagina: String(tamanhoPagina),
    data_vencimento_de: args.dataVencimentoDe,
    data_vencimento_ate: args.dataVencimentoAte,
  });
  if (args.apenasEmAberto) {
    query.set("status", "EM_ABERTO");
  }

  const raw = await caFetch<unknown>(
    `${BUSCAR_PATHS[args.tipo]}?${query.toString()}`,
  );
  return normalizeLancamentos(raw);
}

export interface ParcelaComEvento {
  evento: EventoFinanceiro | null;
  parcela: ParcelaEvento | null;
}

/**
 * Consulta uma parcela por id para resolver o evento financeiro ao qual pertence.
 * GET /v1/financeiro/eventos-financeiros/parcelas/{id}
 */
export async function obterParcelaComEvento(
  parcelaId: string,
): Promise<ParcelaComEvento> {
  const raw = await caFetch<unknown>(
    `/v1/financeiro/eventos-financeiros/parcelas/${encodeURIComponent(parcelaId)}`,
  );
  const { evento, parcela } = normalizeParcelaUnica(raw);
  return { evento, parcela };
}

/**
 * Busca de parcelas: lista todas as parcelas de um evento financeiro.
 * GET /v1/financeiro/eventos-financeiros/{id_evento}/parcelas
 */
export async function listarParcelasDoEvento(
  eventoId: string,
): Promise<{ evento: EventoFinanceiro | null; parcelas: ParcelaEvento[] }> {
  const raw = await caFetch<unknown>(
    `/v1/financeiro/eventos-financeiros/${encodeURIComponent(eventoId)}/parcelas`,
  );
  return normalizeParcelasDoEvento(raw);
}
