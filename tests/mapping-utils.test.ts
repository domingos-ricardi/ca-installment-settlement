import { describe, expect, it } from "vitest";

import { applyFixedParcelaId } from "@/lib/csv/mapping-utils";
import type { FieldMapping } from "@/lib/types";

const PARCELA_UUID = "35473eec-4e74-11ee-b500-9f61de8a8b8b";

describe("applyFixedParcelaId", () => {
  it("preenche parcela_id como valor fixo preservando os demais campos", () => {
    const mapping: FieldMapping = {
      data_pagamento: { kind: "column", column: "Data" },
      valor_bruto: { kind: "column", column: "Valor" },
      metodo_pagamento: { kind: "fixed", value: "PIX" },
    };

    const resultado = applyFixedParcelaId(mapping, PARCELA_UUID);

    expect(resultado.parcela_id).toEqual({ kind: "fixed", value: PARCELA_UUID });
    expect(resultado.data_pagamento).toEqual({ kind: "column", column: "Data" });
    expect(resultado.valor_bruto).toEqual({ kind: "column", column: "Valor" });
    expect(resultado.metodo_pagamento).toEqual({ kind: "fixed", value: "PIX" });
  });

  it("substitui um valor fixo anterior pelo novo id", () => {
    const mapping: FieldMapping = {
      parcela_id: { kind: "fixed", value: "00000000-0000-0000-0000-000000000000" },
    };
    expect(applyFixedParcelaId(mapping, PARCELA_UUID).parcela_id).toEqual({
      kind: "fixed",
      value: PARCELA_UUID,
    });
  });

  it("sobrescreve mapeamento por coluna quando um evento é selecionado", () => {
    const mapping: FieldMapping = {
      parcela_id: { kind: "column", column: "ID da Parcela" },
    };
    expect(applyFixedParcelaId(mapping, PARCELA_UUID).parcela_id).toEqual({
      kind: "fixed",
      value: PARCELA_UUID,
    });
  });

  it("ao limpar a seleção remove apenas a origem fixa de parcela_id", () => {
    const mapping: FieldMapping = {
      parcela_id: { kind: "fixed", value: PARCELA_UUID },
      data_pagamento: { kind: "column", column: "Data" },
    };
    const resultado = applyFixedParcelaId(mapping, null);
    expect(resultado.parcela_id).toBeUndefined();
    expect(resultado.data_pagamento).toEqual({ kind: "column", column: "Data" });
  });

  it("ao limpar a seleção preserva mapeamento por coluna do usuário", () => {
    const mapping: FieldMapping = {
      parcela_id: { kind: "column", column: "ID da Parcela" },
    };
    expect(applyFixedParcelaId(mapping, null)).toBe(mapping);
  });

  it("retorna mapping inalterado ao limpar quando não há parcela_id", () => {
    const mapping: FieldMapping = {};
    expect(applyFixedParcelaId(mapping, null)).toBe(mapping);
  });

  it("não muta o objeto original", () => {
    const mapping: FieldMapping = {
      parcela_id: { kind: "column", column: "A" },
      data_pagamento: { kind: "column", column: "B" },
    };
    applyFixedParcelaId(mapping, PARCELA_UUID);
    expect(mapping.parcela_id).toEqual({ kind: "column", column: "A" });
  });
});
