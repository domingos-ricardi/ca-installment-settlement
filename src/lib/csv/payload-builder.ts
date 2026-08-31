import { isUuid, normalizeEnumValue, normalizeToken, parseBrazilianDate, parseCurrency } from "@/lib/csv/converters";
import type { BaixaPayload, FieldMapping } from "@/lib/types";

/**
 * Construção e validação do payload de baixa a partir de uma linha do CSV
 * e do mapeamento definido na tela.
 */

export interface BuildPayloadResult {
  payload?: BaixaPayload & { parcela_id: string };
  errors: string[];
}

interface RawBaixaValues {
  parcela_id?: string;
  data_pagamento?: string;
  valor_bruto?: number;
  multa?: number;
  juros?: number;
  desconto?: number;
  taxa?: number;
  metodo_pagamento?: string;
  observacao?: string;
  nsu?: string;
}

/** Resolve o valor bruto (string) de um campo conforme sua origem no mapeamento. */
function resolveRawValue(
  key: string,
  mapping: FieldMapping,
  row: Record<string, string>,
): string | undefined {
  const source = mapping[key as keyof FieldMapping];
  if (!source || source.kind === "none") return undefined;
  if (source.kind === "fixed") return source.value;
  return row[source.column];
}

/**
 * Converte + valida todos os campos mapeados de uma linha.
 * Acumula erros descritivos em português para exibição na grid.
 */
export function extractRowValues(
  row: Record<string, string>,
  mapping: FieldMapping,
): { values: RawBaixaValues; errors: string[] } {
  const values: RawBaixaValues = {};
  const errors: string[] = [];

  // parcela_id
  const parcelaId = resolveRawValue("parcela_id", mapping, row)?.trim();
  if (parcelaId !== undefined && parcelaId.length > 0) {
    if (isUuid(parcelaId)) {
      values.parcela_id = parcelaId.toLowerCase();
    } else {
      errors.push("ID da Parcela: não é um UUID válido.");
    }
  }

  // data_pagamento
  const dataPagamento = resolveRawValue("data_pagamento", mapping, row);
  if (dataPagamento !== undefined && dataPagamento.trim().length > 0) {
    const parsedDate = parseBrazilianDate(dataPagamento);
    if (parsedDate) {
      values.data_pagamento = parsedDate;
    } else {
      errors.push(
        `Data do Pagamento: "${dataPagamento}" é inválida (use DD/MM/AAAA ou AAAA-MM-DD; hora anexada é aceita e descartada).`,
      );
    }
  }

  // Campos monetários
  for (const key of ["valor_bruto", "multa", "juros", "desconto", "taxa"] as const) {
    const raw = resolveRawValue(key, mapping, row);
    if (raw === undefined || raw.trim().length === 0) continue;
    const parsedNumber = parseCurrency(raw);
    if (parsedNumber === null) {
      errors.push(`${labelFor(key)}: "${raw}" não é um valor monetário válido.`);
      continue;
    }
    if (parsedNumber < 0) {
      errors.push(`${labelFor(key)}: valor negativo não permitido.`);
      continue;
    }
    values[key] = parsedNumber;
  }

  // metodo_pagamento (enum) — termos comuns do CSV são traduzidos antes da
  // validação ("crédito" → CARTAO_CREDITO etc.), ignorando caixa e acentos.
  const metodo = resolveRawValue("metodo_pagamento", mapping, row);
  if (metodo !== undefined && metodo.trim().length > 0) {
    const traduzido = METODO_PAGAMENTO_TRADUCAO[normalizeToken(metodo)] ?? metodo;
    const normalized = normalizeEnumValue(traduzido, METODO_PAGAMENTO_VALUES);
    if (normalized) {
      values.metodo_pagamento = normalized;
    } else {
      errors.push(`Método de Pagamento: "${metodo}" não é um valor aceito pela API.`);
    }
  }

  // Campos de texto livre
  for (const key of ["observacao", "nsu"] as const) {
    const raw = resolveRawValue(key, mapping, row);
    if (raw !== undefined && raw.trim().length > 0) {
      values[key] = raw.trim();
    }
  }

  return { values, errors };
}

const METODO_PAGAMENTO_VALUES = [
  "DINHEIRO",
  "CARTAO_CREDITO",
  "BOLETO_BANCARIO",
  "CARTAO_CREDITO_VIA_LINK",
  "CHEQUE",
  "CARTAO_DEBITO",
  "TRANSFERENCIA_BANCARIA",
  "OUTRO",
  "CARTEIRA_DIGITAL",
  "CASHBACK",
  "CREDITO_LOJA",
  "CREDITO_VIRTUAL",
  "DEPOSITO_BANCARIO",
  "PIX_PAGAMENTO_INSTANTANEO",
] as const;

/**
 * Tradução de termos comuns de CSV para os valores aceitos pela API.
 * As chaves estão normalizadas via `normalizeToken` (sem acento, caixa
 * alta, espaços/hífens como "_"), então qualquer variação é entendida:
 * "credito", "Credito", "CRÉDITO", "crédito"… → CARTAO_CREDITO.
 * Valores que já são aceitos pela API seguem para `normalizeEnumValue`.
 */
const METODO_PAGAMENTO_TRADUCAO: Record<string, string> = {
  CREDITO: "CARTAO_CREDITO",
  DEBITO: "CARTAO_DEBITO",
  PIX: "PIX_PAGAMENTO_INSTANTANEO",
};

const FIELD_LABELS: Record<string, string> = {
  parcela_id: "ID da Parcela",
  data_pagamento: "Data do Pagamento",
  valor_bruto: "Valor Bruto",
  multa: "Multa",
  juros: "Juros",
  desconto: "Desconto",
  taxa: "Taxa",
  metodo_pagamento: "Método de Pagamento",
  observacao: "Observação",
  nsu: "NSU",
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

const REQUIRED_KEYS = ["parcela_id", "data_pagamento", "valor_bruto"] as const;

/** Valida presença dos campos obrigatórios, acumulando erros descritivos. */
function checkRequiredFields(values: RawBaixaValues): string[] {
  const errors: string[] = [];
  for (const key of REQUIRED_KEYS) {
    if (values[key] === undefined) {
      errors.push(`${labelFor(key)}: campo obrigatório ausente ou inválido.`);
    }
  }
  return errors;
}

/**
 * Monta o payload final da baixa para uma linha.
 * Retorna `payload: undefined` quando houver qualquer erro de validação.
 */
export function buildBaixaPayload(
  row: Record<string, string>,
  mapping: FieldMapping,
  contaFinanceiraId: string,
): BuildPayloadResult {
  const { values, errors } = extractRowValues(row, mapping);
  errors.push(...checkRequiredFields(values));

  if (errors.length > 0 || !values.parcela_id || !values.data_pagamento || values.valor_bruto === undefined) {
    return { errors };
  }

  const composicao: BaixaPayload["composicao_valor"] = {
    valor_bruto: values.valor_bruto,
  };
  if (values.multa !== undefined) composicao.multa = values.multa;
  if (values.juros !== undefined) composicao.juros = values.juros;
  if (values.desconto !== undefined) composicao.desconto = values.desconto;
  if (values.taxa !== undefined) composicao.taxa = values.taxa;

  const payload: BaixaPayload & { parcela_id: string } = {
    parcela_id: values.parcela_id,
    data_pagamento: values.data_pagamento,
    composicao_valor: composicao,
    conta_financeira: contaFinanceiraId,
  };
  if (values.metodo_pagamento) payload.metodo_pagamento = values.metodo_pagamento;
  if (values.observacao) payload.observacao = values.observacao;
  if (values.nsu) payload.nsu = values.nsu;

  return { payload, errors: [] };
}

/** Validação leve para colorir a grid sem montar o payload completo. */
export function validateRow(
  row: Record<string, string>,
  mapping: FieldMapping,
): string[] {
  const { values, errors } = extractRowValues(row, mapping);
  errors.push(...checkRequiredFields(values));
  return errors;
}
