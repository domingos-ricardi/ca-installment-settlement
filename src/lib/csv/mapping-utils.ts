import type { FieldMapping } from "@/lib/types";

/**
 * Transformações puras do mapeamento colunas-do-CSV → campos-do-payload.
 */

/**
 * Preenche o campo `parcela_id` como valor fixo ao selecionar um evento
 * financeiro (todas as linhas do dia pertencem à mesma parcela).
 *
 * - Com `parcelaId`: aplica `{ kind: "fixed", value }` preservando os demais
 *   campos do mapeamento.
 * - Com `null` (seleção limpa): remove apenas se a origem atual for valor
 *   fixo — mapeamento por coluna do usuário é preservado.
 */
export function applyFixedParcelaId(
  mapping: FieldMapping,
  parcelaId: string | null,
): FieldMapping {
  if (parcelaId !== null) {
    return { ...mapping, parcela_id: { kind: "fixed", value: parcelaId } };
  }

  const atual = mapping.parcela_id;
  if (!atual || atual.kind !== "fixed") return mapping;

  const resto: FieldMapping = { ...mapping };
  delete resto.parcela_id;
  return resto;
}
