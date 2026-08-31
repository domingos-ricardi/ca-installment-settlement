import { describe, expect, it } from "vitest";

import {
  dataReferenciaDoEvento,
  normalizeEvento,
  normalizeIsoDate,
  normalizeLancamentos,
  normalizeLancamento,
  normalizeParcelaUnica,
  normalizeParcelasDoEvento,
} from "@/lib/contaazul/evento-normalize";

describe("normalizeIsoDate", () => {
  it("mantém datas ISO puras", () => {
    expect(normalizeIsoDate("2026-08-15")).toBe("2026-08-15");
  });

  it("recorta timestamp de datas ISO completas", () => {
    expect(normalizeIsoDate("2026-08-15T14:30:00Z")).toBe("2026-08-15");
  });

  it("rejeita valores ausentes ou em outro formato", () => {
    expect(normalizeIsoDate(null)).toBeNull();
    expect(normalizeIsoDate(undefined)).toBeNull();
    expect(normalizeIsoDate("")).toBeNull();
    expect(normalizeIsoDate("15/08/2026")).toBeNull();
    expect(normalizeIsoDate(123)).toBeNull();
  });
});

describe("normalizeLancamento", () => {
  const bruto = {
    id: "abc-123",
    descricao: "Vendas cartão 15/08",
    data_vencimento: "2026-08-20",
    data_competencia: "2026-08-15T00:00:00",
    status: "EM_ABERTO",
    status_traduzido: "ATRASADO",
    total: "1500.5",
    nao_pago: 1500.5,
  };

  it("normaliza todos os campos com prioridade para status_traduzido", () => {
    const item = normalizeLancamento(bruto);
    expect(item).toEqual({
      id: "abc-123",
      descricao: "Vendas cartão 15/08",
      data_vencimento: "2026-08-20",
      data_competencia: "2026-08-15",
      status: "ATRASADO",
      total: 1500.5,
      nao_pago: 1500.5,
    });
  });

  it("retorna null sem id", () => {
    expect(normalizeLancamento({ descricao: "sem id" })).toBeNull();
    expect(normalizeLancamento(null)).toBeNull();
    expect(normalizeLancamento("texto")).toBeNull();
  });

  it("tolera campos ausentes", () => {
    expect(normalizeLancamento({ id: "x" })).toEqual({
      id: "x",
      descricao: null,
      data_vencimento: null,
      data_competencia: null,
      status: null,
      total: null,
      nao_pago: null,
    });
  });
});

describe("normalizeLancamentos", () => {
  it("normaliza envelope oficial com itens", () => {
    const page = normalizeLancamentos({
      itens_totais: 3,
      itens: [{ id: "a" }, { id: "b" }, { sem: "id" }],
    });
    expect(page.itensTotais).toBe(3);
    expect(page.itens.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("aceita fallback items e conta itens quando itens_totais ausente", () => {
    const page = normalizeLancamentos({ items: [{ id: "z" }] });
    expect(page.itensTotais).toBe(1);
    expect(page.itens[0].id).toBe("z");
  });

  it("retorna página vazia para corpos inesperados", () => {
    expect(normalizeLancamentos(null)).toEqual({ itensTotais: 0, itens: [] });
    expect(normalizeLancamentos("erro")).toEqual({ itensTotais: 0, itens: [] });
    expect(normalizeLancamentos({})).toEqual({ itensTotais: 0, itens: [] });
  });
});

describe("normalizeEvento", () => {
  it("extrai dados do evento incluindo quantidade de parcelas", () => {
    const evento = normalizeEvento({
      id: "ev-1",
      codigo_referencia: "123456",
      tipo: "RECEITA",
      data_competencia: "2026-08-15",
      condicao_pagamento: { quantidade_parcelas: 3 },
    });
    expect(evento).toEqual({
      id: "ev-1",
      codigo_referencia: "123456",
      tipo: "RECEITA",
      data_competencia: "2026-08-15",
      quantidade_parcelas: 3,
    });
  });

  it("descarta tipo desconhecido e retorna null sem id", () => {
    expect(normalizeEvento({ id: "e", tipo: "OUTRO" })?.tipo).toBeNull();
    expect(normalizeEvento({ tipo: "RECEITA" })).toBeNull();
    expect(normalizeEvento(undefined)).toBeNull();
  });
});

describe("normalizeParcelasDoEvento", () => {
  const parcelaBruta = {
    id: "p-1",
    indice: 2,
    descricao: "Parcela 2",
    data_vencimento: "2026-08-15",
    status: "PENDENTE",
    nao_pago: 100,
    valor_composicao: { valor_bruto: 120, desconto: 0 },
    evento: { id: "ev-9", tipo: "RECEITA", data_competencia: "2026-08-15" },
  };

  it("normaliza resposta em array puro extraindo o evento da primeira parcela", () => {
    const result = normalizeParcelasDoEvento([parcelaBruta]);
    expect(result.evento?.id).toBe("ev-9");
    expect(result.parcelas).toHaveLength(1);
    expect(result.parcelas[0]).toMatchObject({
      id: "p-1",
      indice: 2,
      valor_bruto: 120,
      nao_pago: 100,
    });
  });

  it("aceita envelopes alternativos (itens/items/parcelas)", () => {
    for (const key of ["itens", "items", "parcelas"]) {
      const result = normalizeParcelasDoEvento({ [key]: [parcelaBruta] });
      expect(result.parcelas[0].id).toBe("p-1");
    }
  });

  it("retorna estrutura vazia para corpos inválidos", () => {
    expect(normalizeParcelasDoEvento(null)).toEqual({ evento: null, parcelas: [] });
    expect(normalizeParcelasDoEvento(42)).toEqual({ evento: null, parcelas: [] });
  });
});

describe("normalizeParcelaUnica", () => {
  it("isola a parcela consultada e mantém o evento embutido", () => {
    const result = normalizeParcelaUnica({
      id: "p-solo",
      indice: 1,
      evento: { id: "ev-1", data_competencia: "2026-08-01" },
    });
    expect(result.parcela?.id).toBe("p-solo");
    expect(result.evento?.id).toBe("ev-1");
    expect(result.parcelas).toHaveLength(1);
  });
});

describe("dataReferenciaDoEvento", () => {
  it("prefere a competência do evento", () => {
    expect(
      dataReferenciaDoEvento({ data_competencia: "2026-08-15" } as never, [
        { data_vencimento: "2026-09-01" },
      ]),
    ).toBe("2026-08-15");
  });

  it("usa os fallbacks na ordem quando não há competência", () => {
    expect(dataReferenciaDoEvento(null, [{ data_vencimento: "2026-09-01" }, null])).toBe(
      "2026-09-01",
    );
    expect(dataReferenciaDoEvento(null, [null])).toBeNull();
  });
});
