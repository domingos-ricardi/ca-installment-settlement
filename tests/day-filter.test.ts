import { describe, expect, it } from "vitest";

import {
  isRowInFilterDay,
  resolveFilterColumn,
} from "@/lib/csv/day-filter";
import type { FieldMapping } from "@/lib/types";

describe("resolveFilterColumn", () => {
  const columns = ["Cliente", "Data do Evento", "Vencimento", "Valor"];

  it("prioriza a coluna escolhida anteriormente quando ela existe no CSV", () => {
    expect(resolveFilterColumn(columns, {}, "Vencimento")).toBe("Vencimento");
  });

  it("ignora a coluna persistida quando ela não existe no CSV atual", () => {
    expect(resolveFilterColumn(columns, {}, "Data Antiga")).not.toContain("Data Antiga");
  });

  it("cai para a coluna mapeada em Data do Pagamento", () => {
    const mapping: FieldMapping = {
      data_pagamento: { kind: "column", column: "Vencimento" },
    };
    expect(resolveFilterColumn(columns, mapping)).toBe("Vencimento");
  });

  it("cai para a primeira coluna com 'data' no nome quando não há mapeamento", () => {
    expect(resolveFilterColumn(columns, {})).toBe("Data do Evento");
  });

  it("retorna '' quando não há nenhuma coluna de data", () => {
    expect(resolveFilterColumn(["Cliente", "Valor"], {})).toBe("");
  });

  it("coluna persistida vence o mapeamento", () => {
    const mapping: FieldMapping = {
      data_pagamento: { kind: "column", column: "Vencimento" },
    };
    expect(resolveFilterColumn(columns, mapping, "Data do Evento")).toBe(
      "Data do Evento",
    );
  });
});

describe("isRowInFilterDay", () => {
  const filterDate = "2026-08-05";

  it("compara datas em formato BR (DD/MM/AAAA)", () => {
    expect(isRowInFilterDay({ "Data do Evento": "05/08/2026" }, "Data do Evento", filterDate)).toBe(true);
    expect(isRowInFilterDay({ "Data do Evento": "06/08/2026" }, "Data do Evento", filterDate)).toBe(false);
  });

  it("compara datas em formato ISO (AAAA-MM-DD)", () => {
    expect(isRowInFilterDay({ Data: "2026-08-05" }, "Data", filterDate)).toBe(true);
    expect(isRowInFilterDay({ Data: "2026-08-06" }, "Data", filterDate)).toBe(false);
  });

  it("descarta hora anexada à data", () => {
    expect(
      isRowInFilterDay({ Data: "05/08/2026 14:30" }, "Data", filterDate),
    ).toBe(true);
    expect(
      isRowInFilterDay({ Data: "2026-08-05T10:00:00Z" }, "Data", filterDate),
    ).toBe(true);
  });

  it("coluna vazia considera a linha fora do dia", () => {
    expect(isRowInFilterDay({ Data: "" }, "Data", filterDate)).toBe(false);
  });

  it("coluna inexistente considera a linha fora do dia", () => {
    expect(isRowInFilterDay({ Outra: "05/08/2026" }, "Data", filterDate)).toBe(false);
  });

  it("data inválida considera a linha fora do dia", () => {
    expect(isRowInFilterDay({ Data: "31/02/2026" }, "Data", filterDate)).toBe(false);
  });
});