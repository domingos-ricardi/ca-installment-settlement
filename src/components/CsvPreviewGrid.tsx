"use client";

import { useMemo } from "react";

import { BAIXA_FIELD_MAP } from "@/lib/csv/baixa-fields";
import type { BaixaResult, CsvData, FieldMapping } from "@/lib/types";

interface CsvPreviewGridProps {
  csvData: CsvData;
  mapping: FieldMapping;
  rowErrors: string[][];
  excludedRows: Set<number>;
  /** Linhas válidas porém fora do dia do evento financeiro (não são enviadas). */
  outOfDayRows: Set<number>;
  onToggleRow: (index: number) => void;
  resultsByRow: Map<number, BaixaResult>;
}

const MAX_VISIBLE_ROWS = 100;

/**
 * Grid de pré-visualização do CSV.
 * Colunas mapeadas exibem um badge com o campo do payload que preenchem;
 * cada linha pode ser incluída/excluída do envio e mostra o status de validação.
 */
export function CsvPreviewGrid({
  csvData,
  mapping,
  rowErrors,
  excludedRows,
  outOfDayRows,
  onToggleRow,
  resultsByRow,
}: CsvPreviewGridProps) {
  const columnToField = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [key, source] of Object.entries(mapping)) {
      if (source?.kind === "column") {
        const labels = map.get(source.column) ?? [];
        labels.push(BAIXA_FIELD_MAP[key]?.label ?? key);
        map.set(source.column, labels);
      }
    }
    return map;
  }, [mapping]);

  const visibleRows = csvData.rows.slice(0, MAX_VISIBLE_ROWS);

  return (
    <div>
      {csvData.rows.length > MAX_VISIBLE_ROWS && (
        <p className="mb-2 text-xs text-slate-500">
          Exibindo as primeiras {MAX_VISIBLE_ROWS} de {csvData.rows.length} linhas —
          todas serão processadas (respeitando o filtro do dia e as exclusões).
        </p>
      )}
      <div className="max-h-[480px] overflow-auto rounded-md border border-slate-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              <th className="border-b border-slate-200 px-2 py-2 text-left font-medium text-slate-600">
                Enviar
              </th>
              {csvData.columns.map((column) => {
                const fields = columnToField.get(column);
                return (
                  <th
                    key={column}
                    className={`border-b border-slate-200 px-3 py-2 text-left font-medium whitespace-nowrap ${
                      fields ? "text-blue-700" : "text-slate-600"
                    }`}
                  >
                    {column}
                    {fields && (
                      <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        → {fields.join(", ")}
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const errors = rowErrors[index] ?? [];
              const excluded = excludedRows.has(index);
              const outOfDay = outOfDayRows.has(index);
              const result = resultsByRow.get(index);

              let statusCell;
              if (result) {
                statusCell = result.success ? (
                  <span className="font-medium text-emerald-600">✓ Baixada</span>
                ) : (
                  <span
                    className="font-medium text-red-600"
                    title={result.error}
                  >
                    ✗ Falhou
                  </span>
                );
              } else if (errors.length > 0) {
                statusCell = (
                  <span className="font-medium text-amber-600" title={errors.join("\n")}>
                    ⚠ {errors.length} erro{errors.length > 1 ? "s" : ""}
                  </span>
                );
              } else if (outOfDay) {
                statusCell = (
                  <span className="font-medium text-slate-400" title="Data de pagamento diferente do dia do evento financeiro">
                    Fora do dia
                  </span>
                );
              } else if (excluded) {
                statusCell = <span className="text-slate-400">Ignorada</span>;
              } else {
                statusCell = <span className="text-emerald-600">Pronta</span>;
              }

              return (
                <tr
                  key={index}
                  className={`border-b border-slate-50 last:border-0 ${
                    errors.length > 0 ? "bg-amber-50/60" : ""
                  } ${excluded || (outOfDay && !result) ? "opacity-45" : ""}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => onToggleRow(index)}
                      aria-label={`Incluir linha ${index + 1}`}
                      disabled={Boolean(result) || (outOfDay && !result)}
                      className="h-3.5 w-3.5 accent-blue-600"
                    />
                  </td>
                  {csvData.columns.map((column) => (
                    <td
                      key={column}
                      className="max-w-[220px] truncate px-3 py-1.5 whitespace-nowrap text-slate-700"
                      title={row[column]}
                    >
                      {row[column]}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 whitespace-nowrap">{statusCell}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
