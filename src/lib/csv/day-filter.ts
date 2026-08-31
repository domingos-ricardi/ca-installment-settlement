import { normalizeToken, parseBrazilianDate } from "@/lib/csv/converters";
import type { FieldMapping } from "@/lib/types";

/**
 * Filtro "somente o dia do evento" baseado em uma COLUNA escolhida do CSV
 * (e não no campo "Data do Pagamento" do payload montado).
 */

/**
 * Define a coluna do CSV usada como base do filtro de data.
 *
 * Precedência:
 * 1. coluna escolhida anteriormente, se ainda existir no CSV;
 * 2. coluna mapeada para "Data do Pagamento";
 * 3. primeira coluna com "data" no nome;
 * 4. "" (nenhuma — filtro fica desativado até o usuário escolher).
 */
export function resolveFilterColumn(
  columns: string[],
  mapping: FieldMapping,
  persisted?: string,
): string {
  if (persisted?.length && columns.includes(persisted)) return persisted;

  const mappedDate = mapping.data_pagamento;
  if (mappedDate?.kind === "column" && columns.includes(mappedDate.column)) {
    return mappedDate.column;
  }

  return columns.find((column) => normalizeToken(column).includes("DATA")) ?? "";
}

/**
 * Verifica se a linha está dentro do dia do filtro comparando o valor da
 * coluna escolhida (normalizado para AAAA-MM-DD, formatos BR ou ISO) com a
 * data do filtro. Colunas vazias/inexistentes contam como "fora do dia".
 */
export function isRowInFilterDay(
  row: Record<string, string>,
  filterColumn: string,
  filterDate: string,
): boolean {
  return parseBrazilianDate(row[filterColumn] ?? "") === filterDate;
}