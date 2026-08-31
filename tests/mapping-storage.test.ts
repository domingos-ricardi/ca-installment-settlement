import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  columnSignature,
  isMappingUsable,
  loadSelections,
  loadStoredMapping,
  saveMappingForSignature,
  saveSelections,
} from "@/lib/csv/mapping-storage";
import type { FieldMapping } from "@/lib/types";

/** localStorage mínimo em memória (ambiente node do vitest). */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function installStorage(): void {
  (globalThis as { window?: unknown }).window = {
    localStorage: new MemoryStorage(),
  };
}

function uninstallStorage(): void {
  delete (globalThis as { window?: unknown }).window;
}

const mappingA: FieldMapping = {
  parcela_id: { kind: "column", column: "ID da Parcela" },
  data_pagamento: { kind: "column", column: "Data de Pagamento" },
  valor_bruto: { kind: "column", column: "Valor Bruto" },
  metodo_pagamento: { kind: "fixed", value: "PIX_PAGAMENTO_INSTANTANEO" },
};

const columnsA = ["ID da Parcela", "Data de Pagamento", "Valor Bruto", "Obs"];

beforeEach(installStorage);
afterEach(uninstallStorage);

describe("columnSignature", () => {
  it("é estável para a mesma lista", () => {
    expect(columnSignature(columnsA)).toBe(columnSignature([...columnsA]));
  });

  it("ignora acentos, caixa e espaços entre arquivos equivalentes", () => {
    const outras = ["id da parcela", "DATA DE PAGAMENTO", "valor bruto", "obs"];
    expect(columnSignature(outras)).toBe(columnSignature(columnsA));
  });

  it("diferencia layouts distintos", () => {
    expect(columnSignature(["Outra"])).not.toBe(columnSignature(columnsA));
  });
});

describe("save/loadStoredMapping", () => {
  it("faz roundtrip do mapeamento por assinatura", () => {
    const signature = columnSignature(columnsA);
    saveMappingForSignature(signature, mappingA);
    expect(loadStoredMapping(signature, columnsA)).toEqual(mappingA);
  });

  it("retorna null quando não há mapeamento salvo", () => {
    expect(loadStoredMapping("inexistente", columnsA)).toBeNull();
  });

  it("descarta o mapeamento se alguma coluna referenciada sumiu", () => {
    const signature = columnSignature(columnsA);
    saveMappingForSignature(signature, mappingA);
    // CSV novo sem a coluna "Valor Bruto".
    expect(loadStoredMapping(signature, ["ID da Parcela", "Data de Pagamento"])).toBeNull();
  });

  it("mantém o mapeamento quando só colunas não referenciadas mudam", () => {
    const signature = columnSignature(columnsA);
    saveMappingForSignature(signature, mappingA);
    const comExtra = [...columnsA, "Coluna Nova"];
    expect(loadStoredMapping(signature, comExtra)).toEqual(mappingA);
  });

  it("aplica limite LRU de mapeamentos guardados", () => {
    for (let i = 0; i < 25; i++) {
      saveMappingForSignature(`sig-${i}`, mappingA);
    }
    const raw = JSON.parse(
      (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.getItem("api-ca:persistence:v1") ?? "{}",
    ) as { mappings: Record<string, unknown> };
    expect(Object.keys(raw.mappings)).toHaveLength(20);
    expect(loadStoredMapping("sig-24", columnsA)).toEqual(mappingA); // mais recente sobrevive
    expect(loadStoredMapping("sig-0", columnsA)).toBeNull(); // mais antigo foi removido
  });
});

describe("isMappingUsable", () => {
  it("aceita colunas e valores fixos; rejeita coluna ausente", () => {
    expect(isMappingUsable(mappingA, columnsA)).toBe(true);
    expect(isMappingUsable(mappingA, ["Outra coluna"])).toBe(false);
  });
});

describe("selections", () => {
  it("mescla patches preservando campos anteriores", () => {
    saveSelections({ contaFinanceiraId: "conta-1", eventoTipo: "RECEITA" });
    saveSelections({ lancamentoId: "lanc-9", dayFilterEnabled: true });
    expect(loadSelections()).toEqual({
      contaFinanceiraId: "conta-1",
      eventoTipo: "RECEITA",
      lancamentoId: "lanc-9",
      dayFilterEnabled: true,
    });
  });

  it("retorna vazio quando storage indisponível ou corrompido", () => {
    uninstallStorage();
    expect(loadSelections()).toEqual({});
    expect(loadStoredMapping("x", [])).toBeNull();

    installStorage();
    (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.setItem(
      "api-ca:persistence:v1",
      "{quebrado",
    );
    expect(loadSelections()).toEqual({});
  });
});
