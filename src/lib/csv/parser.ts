"use client";

import Papa from "papaparse";

import type { CsvData } from "@/lib/types";

export interface ParseOptions {
  /** Limite de linhas carregadas em memória (proteção contra arquivos gigantes). */
  maxRows?: number;
}

/**
 * Faz o parse de um arquivo CSV no navegador usando PapaParse (worker local).
 * Primeira linha é tratada como cabeçalho; linhas vazias são ignoradas.
 */
export function parseCsvFile(
  file: File,
  options: ParseOptions = {},
): Promise<CsvData> {
  const maxRows = options.maxRows ?? 5000;

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const rows = result.data
          .filter((row) => Object.values(row).some((v) => (v ?? "").trim() !== ""))
          .slice(0, maxRows);

        const columns = deduplicateColumns(
          (result.meta.fields ?? []).map((c) => c.trim()).filter((c) => c.length > 0),
        );

        if (columns.length === 0) {
          reject(new Error("O CSV não possui cabeçalho válido."));
          return;
        }

        resolve({ fileName: file.name, columns, rows });
      },
      error: (error) => reject(error),
    });
  });
}

/** Garante nomes de coluna únicos (CSVs podem ter cabeçalhos duplicados). */
function deduplicateColumns(columns: string[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((column) => {
    const count = seen.get(column) ?? 0;
    seen.set(column, count + 1);
    return count === 0 ? column : `${column} (${count + 1})`;
  });
}
