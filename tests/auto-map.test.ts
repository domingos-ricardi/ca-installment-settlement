import { describe, expect, it } from "vitest";

import { suggestMapping } from "@/lib/csv/auto-map";

describe("suggestMapping", () => {
  it("mapeia colunas por nomes equivalentes", () => {
    const mapping = suggestMapping([
      "ID da Parcela",
      "Data de Pagamento",
      "Valor Bruto",
      "Multa",
      "Juros",
      "Forma de Pagamento",
      "Observação",
    ]);

    expect(mapping.parcela_id).toEqual({ kind: "column", column: "ID da Parcela" });
    expect(mapping.data_pagamento).toEqual({ kind: "column", column: "Data de Pagamento" });
    expect(mapping.valor_bruto).toEqual({ kind: "column", column: "Valor Bruto" });
    expect(mapping.multa).toEqual({ kind: "column", column: "Multa" });
    expect(mapping.juros).toEqual({ kind: "column", column: "Juros" });
    expect(mapping.metodo_pagamento).toEqual({
      kind: "column",
      column: "Forma de Pagamento",
    });
    expect(mapping.observacao).toEqual({ kind: "column", column: "Observação" });
  });

  it("não reutiliza a mesma coluna para dois campos", () => {
    const mapping = suggestMapping(["Parcela", "Data", "Valor"]);
    const usedColumns = Object.values(mapping)
      .filter((s): s is { kind: "column"; column: string } => s.kind === "column")
      .map((s) => s.column);

    expect(new Set(usedColumns).size).toBe(usedColumns.length);
  });

  it("retorna vazio para colunas sem semelhança", () => {
    const mapping = suggestMapping(["foo", "bar", "baz"]);
    expect(Object.keys(mapping)).toHaveLength(0);
  });

  it("prefere correspondências mais específicas", () => {
    const mapping = suggestMapping(["Valor Líquido", "Valor Bruto"]);
    // "Valor Bruto" é alias direto; "Valor Líquido" não deve ser escolhido para valor_bruto
    expect(mapping.valor_bruto).toEqual({ kind: "column", column: "Valor Bruto" });
  });
});
