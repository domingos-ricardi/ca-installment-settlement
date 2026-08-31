import type {
  EventoFinanceiro,
  EventoTipo,
  LancamentoResumo,
  ParcelaEvento,
} from "@/lib/types";

/**
 * Normalização defensiva das respostas da API do Conta Azul para os tipos
 * internos. A API varia a grafia de campos entre endpoints (`itens`/`items`,
 * objetos aninhados etc.), então toda leitura é tolerante e testável.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Aceita apenas datas AAAA-MM-DD (recorta timestamp quando presente). */
export function normalizeIsoDate(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : null;
}

/* -------------------------------------------------------------------------- */
/* Busca de lançamentos (contas a receber / contas a pagar)                    */
/* -------------------------------------------------------------------------- */

/** Normaliza um item da busca; retorna `null` quando não há id utilizável. */
export function normalizeLancamento(raw: unknown): LancamentoResumo | null {
  const record = asRecord(raw);
  const id = record ? asString(record.id) : null;
  if (!id) return null;

  return {
    id,
    descricao: record ? asString(record.descricao) : null,
    data_vencimento: record ? normalizeIsoDate(record.data_vencimento) : null,
    data_competencia: record ? normalizeIsoDate(record.data_competencia) : null,
    status: record
      ? (asString(record.status_traduzido) ?? asString(record.status))
      : null,
    total: record ? asNumber(record.total) : null,
    nao_pago: record ? asNumber(record.nao_pago) : null,
  };
}

export interface LancamentosPage {
  itensTotais: number;
  itens: LancamentoResumo[];
}

/**
 * Normaliza o corpo paginado da busca (`itens` com fallback para `items`).
 * Corpos inesperados resultam em página vazia, nunca em exceção.
 */
export function normalizeLancamentos(payload: unknown): LancamentosPage {
  const body = asRecord(payload);
  const list = body
    ? (Array.isArray(body.itens) ? body.itens : Array.isArray(body.items) ? body.items : [])
    : [];

  const itens = list
    .map(normalizeLancamento)
    .filter((item): item is LancamentoResumo => item !== null);

  const itensTotais = body ? asNumber(body.itens_totais) ?? itens.length : 0;
  return { itensTotais, itens };
}

/* -------------------------------------------------------------------------- */
/* Evento financeiro + parcelas                                                */
/* -------------------------------------------------------------------------- */

/** Normaliza o objeto `evento` embutido em uma parcela. */
export function normalizeEvento(raw: unknown): EventoFinanceiro | null {
  const evento = asRecord(raw);
  const id = evento ? asString(evento.id) : null;
  if (!evento || !id) return null;

  const tipoBruto = asString(evento.tipo);
  const tipo: EventoTipo | null =
    tipoBruto === "RECEITA" || tipoBruto === "DESPESA" ? tipoBruto : null;
  const condicao = asRecord(evento.condicao_pagamento);

  return {
    id,
    codigo_referencia: asString(evento.codigo_referencia),
    tipo,
    data_competencia: normalizeIsoDate(evento.data_competencia),
    quantidade_parcelas: condicao ? asNumber(condicao.quantidade_parcelas) : null,
  };
}

/** Normaliza uma parcela retornada pelos endpoints de parcelas. */
export function normalizeParcelaEvento(raw: unknown): ParcelaEvento | null {
  const parcela = asRecord(raw);
  const id = parcela ? asString(parcela.id) : null;
  if (!parcela || !id) return null;

  const composicao = asRecord(parcela.valor_composicao);
  return {
    id,
    indice: asNumber(parcela.indice),
    descricao: asString(parcela.descricao),
    data_vencimento: normalizeIsoDate(parcela.data_vencimento),
    status: asString(parcela.status),
    valor_bruto: composicao ? asNumber(composicao.valor_bruto) : null,
    nao_pago: asNumber(parcela.nao_pago),
  };
}

export interface ParcelasDoEvento {
  evento: EventoFinanceiro | null;
  parcelas: ParcelaEvento[];
}

/**
 * Normaliza a resposta de `GET .../eventos-financeiros/{id_evento}/parcelas`.
 * A documentação declara um array de parcelas (cada uma com `evento` embutido);
 * por robustez aceita também envelope `{ itens | items | parcelas }`.
 */
export function normalizeParcelasDoEvento(payload: unknown): ParcelasDoEvento {
  let list: unknown[] = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else {
    const body = asRecord(payload);
    if (body) {
      for (const key of ["itens", "items", "parcelas"]) {
        if (Array.isArray(body[key])) {
          list = body[key] as unknown[];
          break;
        }
      }
      // Envelope com objeto único de evento no topo.
      if (list.length === 0 && body.evento) {
        const diretas = body.parcelas;
        list = Array.isArray(diretas) ? diretas : [];
      }
    }
  }

  const parcelas = list
    .map(normalizeParcelaEvento)
    .filter((p): p is ParcelaEvento => p !== null);

  const evento =
    list
      .map((item) => asRecord(item)?.evento)
      .map(normalizeEvento)
      .find((e): e is EventoFinanceiro => e !== null) ?? null;

  return { evento, parcelas };
}

/** Extrai `{ evento, parcela }` da resposta de `GET .../parcelas/{id}`. */
export function normalizeParcelaUnica(payload: unknown): ParcelasDoEvento & {
  parcela: ParcelaEvento | null;
} {
  const { evento, parcelas } = normalizeParcelasDoEvento(
    Array.isArray(payload) ? payload : [payload],
  );
  const unica = parcelas.length > 0 ? parcelas[0] : null;
  return { evento, parcelas: unica ? [unica] : [], parcela: unica };
}

/**
 * Data de referência do dia do evento: competência do evento; na ausência,
 * vencimento da parcela selecionada ou de sua primeira parcela.
 */
export function dataReferenciaDoEvento(
  evento: EventoFinanceiro | null,
  fallbacks: Array<Pick<ParcelaEvento, "data_vencimento"> | null | undefined>,
): string | null {
  if (evento?.data_competencia) return evento.data_competencia;
  for (const fallback of fallbacks) {
    const data = fallback?.data_vencimento ?? null;
    if (data) return data;
  }
  return null;
}
