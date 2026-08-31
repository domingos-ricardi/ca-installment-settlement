import type { BaixaFieldDef } from "@/lib/types";

/**
 * Definição dos campos do payload da API de baixa do Conta Azul
 * (POST /v1/financeiro/eventos-financeiros/parcelas/{parcela_id}/baixa).
 *
 * `conta_financeira` não entra nesta lista: é escolhido globalmente
 * no dropdown de Conta Bancária da tela.
 */
export const BAIXA_FIELDS: readonly BaixaFieldDef[] = [
  {
    key: "parcela_id",
    label: "ID da Parcela",
    required: true,
    type: "uuid",
    hint: "UUID da parcela em eventos financeiros (path do endpoint).",
  },
  {
    key: "data_pagamento",
    label: "Data do Pagamento",
    required: true,
    type: "date",
    hint: "Aceita DD/MM/AAAA ou AAAA-MM-DD; hora anexada é descartada.",
  },
  {
    key: "valor_bruto",
    label: "Valor Bruto",
    required: true,
    type: "currency",
    hint: "Valor principal da baixa. Aceita R$ 1.234,56.",
  },
  { key: "multa", label: "Multa", required: false, type: "currency" },
  { key: "juros", label: "Juros", required: false, type: "currency" },
  { key: "desconto", label: "Desconto", required: false, type: "currency" },
  { key: "taxa", label: "Taxa", required: false, type: "currency" },
  {
    key: "metodo_pagamento",
    label: "Método de Pagamento",
    required: false,
    type: "enum",
    enumValues: [
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
    ],
    hint: "Deixe sem mapear para não enviar. Crédito, Débito e PIX (em qualquer caixa/acento) viram CARTAO_CREDITO, CARTAO_DEBITO e PIX_PAGAMENTO_INSTANTANEO; demais valores devem ser aceitos pela API.",
  },
  { key: "observacao", label: "Observação", required: false, type: "text" },
  { key: "nsu", label: "NSU", required: false, type: "text" },
] as const;

export const BAIXA_FIELD_MAP: Record<string, BaixaFieldDef> = Object.fromEntries(
  BAIXA_FIELDS.map((f) => [f.key, f]),
);

/** Rótulos por chave — usados nos badges da grid de pré-visualização. */
export const BAIXA_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  BAIXA_FIELDS.map((f) => [f.key, f.label]),
);
