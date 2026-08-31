/**
 * Tipos compartilhados entre frontend e backend.
 */

/** Conta financeira (conta bancária/caixa) retornada pela API do Conta Azul. */
export interface ContaFinanceira {
  id: string;
  nome: string;
  banco?: string | null;
  codigo_banco?: number | null;
  tipo?: string | null;
  ativo?: boolean | null;
  conta_padrao?: boolean | null;
  agencia?: string | null;
  numero?: string | null;
}

export interface ContasFinanceirasResponse {
  itens_totais?: number;
  itens: ContaFinanceira[];
}

/** Tipos de dado suportados ao converter valores do CSV. */
export type FieldType = "text" | "date" | "currency" | "enum" | "uuid";

/**
 * Campos que compõem o payload da API de baixa do Conta Azul.
 * `parcela_id` é path param; os demais vão no corpo da requisição.
 */
export type BaixaFieldKey =
  | "parcela_id"
  | "data_pagamento"
  | "valor_bruto"
  | "multa"
  | "juros"
  | "desconto"
  | "taxa"
  | "metodo_pagamento"
  | "observacao"
  | "nsu";

export interface BaixaFieldDef {
  key: BaixaFieldKey;
  label: string;
  required: boolean;
  type: FieldType;
  /** Valores aceitos quando `type === "enum"`. */
  enumValues?: readonly string[];
  hint?: string;
}

/** Origem do valor de um campo: coluna do CSV, valor fixo ou não mapeado. */
export type FieldSource =
  | { kind: "column"; column: string }
  | { kind: "fixed"; value: string }
  | { kind: "none" };

/** Mapeamento campo-do-payload → origem. */
export type FieldMapping = Partial<Record<BaixaFieldKey, FieldSource>>;

/** Dados extraídos de um arquivo CSV. */
export interface CsvData {
  fileName: string;
  columns: string[];
  rows: Record<string, string>[];
}

/** Payload enviado à API de baixa (POST .../parcelas/{id}/baixa). */
export interface BaixaPayload {
  data_pagamento: string; // YYYY-MM-DD
  composicao_valor: {
    valor_bruto: number;
    multa?: number;
    juros?: number;
    desconto?: number;
    taxa?: number;
  };
  conta_financeira: string;
  metodo_pagamento?: string;
  observacao?: string;
  nsu?: string;
}

/** Tipo do evento financeiro no Conta Azul. */
export type EventoTipo = "RECEITA" | "DESPESA";

/**
 * Lançamento retornado pela busca de contas a receber/pagar
 * (GET /v1/financeiro/eventos-financeiros/contas-a-{receber,pagar}/buscar).
 * Cada item corresponde a uma parcela com dados resumidos.
 */
export interface LancamentoResumo {
  id: string;
  descricao: string | null;
  data_vencimento: string | null;
  data_competencia: string | null;
  status: string | null;
  total: number | null;
  nao_pago: number | null;
}

/** Evento financeiro ao qual as parcelas pertencem. */
export interface EventoFinanceiro {
  id: string;
  codigo_referencia: string | null;
  tipo: EventoTipo | null;
  data_competencia: string | null;
  quantidade_parcelas: number | null;
}

/** Parcela de um evento financeiro (GET .../eventos-financeiros/{id_evento}/parcelas). */
export interface ParcelaEvento {
  id: string;
  indice: number | null;
  descricao: string | null;
  data_vencimento: string | null;
  status: string | null;
  valor_bruto: number | null;
  nao_pago: number | null;
}

/** Item de baixa recebido pela rota interna /api/baixas. */
export interface BaixaItemInput {
  parcela_id: string;
  data_pagamento: string; // YYYY-MM-DD
  composicao_valor: BaixaPayload["composicao_valor"];
  metodo_pagamento?: string;
  observacao?: string;
  nsu?: string;
}

/** Resultado individual do processamento em lote. */
export interface BaixaResult {
  index: number;
  parcela_id: string;
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}
