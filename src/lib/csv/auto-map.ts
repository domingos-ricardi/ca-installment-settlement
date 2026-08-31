import { normalizeToken } from "@/lib/csv/converters";
import type { BaixaFieldKey, FieldMapping } from "@/lib/types";

/**
 * Sugestão automática de mapeamento: associa colunas do CSV aos campos
 * do payload por similaridade de nome (acentos/caixa/separadores ignorados).
 */

/** Aliases por campo, do mais específico para o mais genérico. */
const ALIASES: Record<BaixaFieldKey, string[][]> = {
  parcela_id: [
    ["IDDA PARCELA", "IDPARCELA", "PARCELaid", "UUIDPARCELA", "PARCELAUUID"],
    ["NUMEROPARCELA", "NPARCELA"],
    ["PARCELA"],
  ],
  data_pagamento: [
    ["DATADOPAGAMENTO", "DATADEPAGAMENTO", "DATAPAGAMENTO", "DTPAGAMENTO"],
    ["DTPAGTO", "DTBAIXA", "DATABAIXA"],
    ["PAGAMENTO"],
  ],
  valor_bruto: [["VALORBRUTO", "VLBRUTO", "VLRBRUTO"], ["VALORTOTAL"], ["VALOR"]],
  multa: [["MULTA"]],
  juros: [["JUROS", "JURO"]],
  desconto: [["DESCONTO", "DESC"]],
  taxa: [["TAXA", "TAXAADMINISTRATIVA"]],
  metodo_pagamento: [
    ["METODODEPAGAMENTO", "METODOPAGAMENTO", "FORMADEPAGAMENTO", "FORMAPAGAMENTO"],
    ["METODO", "FORMAPGTO"],
  ],
  observacao: [["OBSERVACAO", "OBSERVACÕES"], ["OBS"], ["DESCRICAO"]],
  nsu: [["NSU"], ["NUMEROSEQUENCIAL"]],
};

/** Ordem de resolução: campos obrigatórios primeiro, evitando "roubo" de colunas. */
const FIELD_ORDER: BaixaFieldKey[] = [
  "parcela_id",
  "data_pagamento",
  "valor_bruto",
  "metodo_pagamento",
  "multa",
  "juros",
  "desconto",
  "taxa",
  "observacao",
  "nsu",
];

function canonical(value: string): string {
  return normalizeToken(value).replace(/_/g, "");
}

function matches(columnCanonical: string, aliasParts: string[]): boolean {
  return aliasParts.some((alias) => {
    const aliasCanonical = canonical(alias);
    return (
      columnCanonical === aliasCanonical ||
      columnCanonical.includes(aliasCanonical)
    );
  });
}

/**
 * Sugere um mapeamento coluna → campo. Cada coluna é usada no máximo uma vez;
 * correspondências específicas têm prioridade sobre genéricas.
 */
export function suggestMapping(columns: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();

  for (const field of FIELD_ORDER) {
    for (const aliasGroup of ALIASES[field]) {
      const column = columns.find(
        (c) => !used.has(c) && matches(canonical(c), aliasGroup),
      );
      if (column) {
        mapping[field] = { kind: "column", column };
        used.add(column);
        break;
      }
    }
  }

  return mapping;
}
