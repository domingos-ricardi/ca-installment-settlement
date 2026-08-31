import { describe, expect, it } from "vitest";

import {
  normalizeEnumValue,
  parseBrazilianDate,
  parseCurrency,
} from "@/lib/csv/converters";

describe("parseBrazilianDate", () => {
  it("converte DD/MM/AAAA para ISO", () => {
    expect(parseBrazilianDate("25/12/2024")).toBe("2024-12-25");
    expect(parseBrazilianDate("01/01/2025")).toBe("2025-01-01");
  });

  it("aceita dia/mês sem zero à esquerda", () => {
    expect(parseBrazilianDate("1/2/2024")).toBe("2024-02-01");
  });

  it("mantém datas já em ISO", () => {
    expect(parseBrazilianDate("2024-12-25")).toBe("2024-12-25");
  });

  it("aceita separadores hífen e ponto no formato BR", () => {
    expect(parseBrazilianDate("25-12-2024")).toBe("2024-12-25");
    expect(parseBrazilianDate("25.12.2024")).toBe("2024-12-25");
  });

  it("ignora hora anexada à data ISO", () => {
    expect(parseBrazilianDate("2024-12-25T10:30:00Z")).toBe("2024-12-25");
    expect(parseBrazilianDate("2024-12-25 10:30")).toBe("2024-12-25");
  });

  it("ignora hora anexada à data BR (dd/MM/aaaa HH:mm)", () => {
    expect(parseBrazilianDate("25/12/2024 14:30")).toBe("2024-12-25");
    expect(parseBrazilianDate("25/12/2024 14:30:45")).toBe("2024-12-25");
    expect(parseBrazilianDate("1/2/2024 7:05")).toBe("2024-02-01");
  });

  it("ignora hora com vírgula ou separador BR alternativo", () => {
    expect(parseBrazilianDate("25/12/2024, 14:30")).toBe("2024-12-25");
    expect(parseBrazilianDate("25-12-2024 10:00")).toBe("2024-12-25");
  });

  it("valida a data mesmo quando a hora é inválida ou lixo", () => {
    // A parte de hora é irrelevante para a API — só a data precisa ser válida.
    expect(parseBrazilianDate("25/12/2024 99:99")).toBe("2024-12-25");
  });

  it("rejeita datas BR inválidas mesmo com hora anexada", () => {
    expect(parseBrazilianDate("31/02/2024 10:00")).toBeNull();
    expect(parseBrazilianDate("15/13/2026 10:00")).toBeNull();
    expect(parseBrazilianDate("abc 10:00")).toBeNull();
  });

  it("retorna null para datas inválidas ou vazias", () => {
    expect(parseBrazilianDate("31/02/2024")).toBeNull();
    expect(parseBrazilianDate("")).toBeNull();
    expect(parseBrazilianDate("   ")).toBeNull();
    expect(parseBrazilianDate("não é data")).toBeNull();
    expect(parseBrazilianDate("2024/13/01")).toBeNull();
  });
});

describe("parseCurrency", () => {
  it("interpreta formato brasileiro com R$, ponto de milhar e vírgula decimal", () => {
    expect(parseCurrency("R$ 1.234,56")).toBe(1234.56);
    expect(parseCurrency("1.234.567,89")).toBe(1234567.89);
  });

  it("interpreta vírgula como decimal", () => {
    expect(parseCurrency("1234,56")).toBe(1234.56);
    expect(parseCurrency("-10,50")).toBe(-10.5);
  });

  it("interpreta ponto como decimal quando não há padrão de milhar", () => {
    expect(parseCurrency("1234.56")).toBe(1234.56);
    expect(parseCurrency("0.99")).toBe(0.99);
  });

  it("interpreta ponto como milhar no padrão grupos-de-três", () => {
    expect(parseCurrency("1.234")).toBe(1234);
    expect(parseCurrency("12.345.678")).toBe(12345678);
  });

  it("aceita números puros e remove espaços", () => {
    expect(parseCurrency("150")).toBe(150);
    expect(parseCurrency(" R$ 150 ")).toBe(150);
  });

  it("retorna null para vazio ou inválido", () => {
    expect(parseCurrency("")).toBeNull();
    expect(parseCurrency("   ")).toBeNull();
    expect(parseCurrency("abc")).toBeNull();
    expect(parseCurrency("R$ --")).toBeNull();
  });

  it("retorna zero para valor zerado", () => {
    expect(parseCurrency("R$ 0,00")).toBe(0);
  });
});

describe("normalizeEnumValue", () => {
  const metodos = ["DINHEIRO", "TRANSFERENCIA_BANCARIA", "BOLETO_BANCARIO"];

  it("normaliza acentos, espaços e caixa antes de comparar", () => {
    expect(normalizeEnumValue("Transferência Bancária", metodos)).toBe(
      "TRANSFERENCIA_BANCARIA",
    );
    expect(normalizeValueSafe("  dinheiro  ", metodos)).toBe("DINHEIRO");
  });

  it("compara ignorando hifenização e underscores", () => {
    expect(normalizeEnumValue("boleto-bancario", metodos)).toBe("BOLETO_BANCARIO");
  });

  it("retorna null quando não há correspondência", () => {
    expect(normalizeEnumValue("pix", metodos)).toBeNull();
    expect(normalizeEnumValue("", metodos)).toBeNull();
  });

  function normalizeValueSafe(value: string, allowed: string[]) {
    return normalizeEnumValue(value, allowed);
  }
});
