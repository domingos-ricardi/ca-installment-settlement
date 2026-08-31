import { describe, expect, it } from "vitest";

import { BAIXA_FIELDS } from "@/lib/csv/baixa-fields";
import {
  buildBaixaPayload,
  validateRow,
} from "@/lib/csv/payload-builder";
import type { FieldMapping } from "@/lib/types";

const row = {
  "ID Parcela": "35473eec-4e74-11ee-b500-9f61de8a8b8b",
  Data: "25/12/2024",
  Valor: "R$ 1.234,56",
  Multa: "5,00",
  Juros: "2,50",
  Desconto: "",
  Método: "Transferência Bancária",
  Obs: "Pgto parcial fatura 123",
};

const mapping: FieldMapping = {
  parcela_id: { kind: "column", column: "ID Parcela" },
  data_pagamento: { kind: "column", column: "Data" },
  valor_bruto: { kind: "column", column: "Valor" },
  multa: { kind: "column", column: "Multa" },
  juros: { kind: "column", column: "Juros" },
  metodo_pagamento: { kind: "column", column: "Método" },
  observacao: { kind: "column", column: "Obs" },
};

describe("buildBaixaPayload", () => {
  it("monta o payload completo a partir das colunas mapeadas", () => {
    const result = buildBaixaPayload(row, mapping, "conta-uuid-1");

    expect(result.errors).toEqual([]);
    expect(result.payload).toEqual({
      parcela_id: "35473eec-4e74-11ee-b500-9f61de8a8b8b",
      data_pagamento: "2024-12-25",
      composicao_valor: {
        valor_bruto: 1234.56,
        multa: 5,
        juros: 2.5,
      },
      conta_financeira: "conta-uuid-1",
      metodo_pagamento: "TRANSFERENCIA_BANCARIA",
      observacao: "Pgto parcial fatura 123",
    });
  });

  it("omite campos opcionais vazios ou não mapeados", () => {
    const result = buildBaixaPayload(row, mapping, "conta-uuid-1");
    const composicao = result.payload!.composicao_valor;

    expect(composicao).not.toHaveProperty("desconto");
    expect(result.payload).not.toHaveProperty("nsu");
  });

  it("suporta valores fixos no lugar de colunas", () => {
    const fixedMapping: FieldMapping = {
      ...mapping,
      metodo_pagamento: { kind: "fixed", value: "PIX_PAGAMENTO_INSTANTANEO" },
    };

    const result = buildBaixaPayload(row, fixedMapping, "conta-uuid-1");
    expect(result.payload?.metodo_pagamento).toBe("PIX_PAGAMENTO_INSTANTANEO");
  });

  it("reporta erro para campos obrigatórios não mapeados", () => {
    const incomplete: FieldMapping = {
      parcela_id: { kind: "none" },
      data_pagamento: { kind: "none" },
      valor_bruto: { kind: "none" },
    };

    const result = buildBaixaPayload(row, incomplete, "conta-uuid-1");
    expect(result.payload).toBeUndefined();
    expect(result.errors.some((e) => e.includes("ID da Parcela"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Data do Pagamento"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Valor Bruto"))).toBe(true);
  });

  it("reporta erro para valor inválido em campo obrigatório", () => {
    const badRow = { ...row, Data: "data inválida", Valor: "abc" };
    const result = buildBaixaPayload(badRow, mapping, "conta-uuid-1");

    expect(result.payload).toBeUndefined();
    expect(result.errors.some((e) => e.includes("Data do Pagamento"))).toBe(true);
    expect(result.errors.some((e) => e.includes("Valor Bruto"))).toBe(true);
  });

  it("reporta erro para método de pagamento fora do enum", () => {
    const badRow = { ...row, Método: "pagamento misterioso" };
    const result = buildBaixaPayload(badRow, mapping, "conta-uuid-1");

    expect(result.payload).toBeUndefined();
    expect(result.errors.some((e) => e.includes("Método de Pagamento"))).toBe(true);
  });

  it.each([
    ["CARTAO_CREDITO", ["Crédito", "credito", "Credito", "CREDITO", "crédito", "CRÉDITO"]],
    ["CARTAO_DEBITO", ["Débito", "debito", "Debito", "DEBITO", "débito", "DÉBITO"]],
    ["PIX_PAGAMENTO_INSTANTANEO", ["PIX", "pix", "Pix"]],
  ])("converte variações de caixa/acento de %s ignorando case", (esperado, variantes) => {
    for (const csvValue of variantes) {
      const result = buildBaixaPayload({ ...row, Método: csvValue }, mapping, "conta-uuid-1");

      expect(result.errors, `falhou para "${csvValue}"`).toEqual([]);
      expect(result.payload?.metodo_pagamento, `falhou para "${csvValue}"`).toBe(esperado);
    }
  });

  it("aplica a tradução também em valor fixo", () => {
    const fixedMapping: FieldMapping = {
      ...mapping,
      metodo_pagamento: { kind: "fixed", value: "Crédito" },
    };

    const result = buildBaixaPayload(row, fixedMapping, "conta-uuid-1");
    expect(result.payload?.metodo_pagamento).toBe("CARTAO_CREDITO");
  });

  it("mantém convertendo valores que já são aceitos pela API", () => {
    const result = buildBaixaPayload({ ...row, Método: "boleto bancario" }, mapping, "conta-uuid-1");
    expect(result.payload?.metodo_pagamento).toBe("BOLETO_BANCARIO");
  });

  it("reporta erro quando parcela_id não é um UUID", () => {
    const badRow = { ...row, "ID Parcela": "123" };
    const result = buildBaixaPayload(badRow, mapping, "conta-uuid-1");

    expect(result.payload).toBeUndefined();
    expect(result.errors.some((e) => e.includes("ID da Parcela"))).toBe(true);
  });
});

describe("validateRow", () => {
  it("não retorna erros para linha válida", () => {
    const errors = validateRow(row, mapping);
    expect(errors).toEqual([]);
  });

  it("acumula todos os erros da linha", () => {
    const badRow = { ...row, Data: "", Valor: "" };
    const errors = validateRow(badRow, mapping);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("BAIXA_FIELDS", () => {
  it("define exatamente os campos obrigatórios esperados pela API", () => {
    const required = BAIXA_FIELDS.filter((f) => f.required).map((f) => f.key);
    expect(required.sort()).toEqual(
      ["data_pagamento", "parcela_id", "valor_bruto"].sort(),
    );
  });
});
