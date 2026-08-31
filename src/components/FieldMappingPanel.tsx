"use client";

import { BAIXA_FIELDS } from "@/lib/csv/baixa-fields";
import type { BaixaFieldKey, FieldMapping, FieldSource } from "@/lib/types";

interface FieldMappingPanelProps {
  columns: string[];
  mapping: FieldMapping;
  onChange: (mapping: FieldMapping) => void;
}

/** Painel que define qual coluna do CSV (ou valor fixo) preenche cada campo do payload. */
export function FieldMappingPanel({ columns, mapping, onChange }: FieldMappingPanelProps) {
  function update(key: BaixaFieldKey, source: FieldSource) {
    onChange({ ...mapping, [key]: source });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Campo do Payload</th>
            <th className="py-2 pr-4 font-medium">Origem</th>
            <th className="py-2 font-medium">Valor / Coluna</th>
          </tr>
        </thead>
        <tbody>
          {BAIXA_FIELDS.map((field) => {
            const source = mapping[field.key] ?? { kind: "none" as const };
            return (
              <tr key={field.key} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-4 align-top">
                  <span className="font-medium text-slate-800">{field.label}</span>
                  {field.required && <span className="ml-1 text-red-500">*</span>}
                  {field.hint && (
                    <p className="mt-0.5 max-w-xs text-xs text-slate-400">{field.hint}</p>
                  )}
                </td>
                <td className="py-2.5 pr-4 align-top">
                  <select
                    value={source.kind}
                    onChange={(e) => {
                      const kind = e.target.value as FieldSource["kind"];
                      update(
                        field.key,
                        kind === "column"
                          ? { kind: "column", column: columns[0] ?? "" }
                          : kind === "fixed"
                            ? { kind: "fixed", value: "" }
                            : { kind: "none" },
                      );
                    }}
                    aria-label={`Origem do campo ${field.label}`}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="none">— Não enviar —</option>
                    <option value="column">Coluna do CSV</option>
                    <option value="fixed">Valor fixo</option>
                  </select>
                </td>
                <td className="py-2.5 align-top">
                  {source.kind === "column" && (
                    <select
                      value={source.column}
                      onChange={(e) => update(field.key, { kind: "column", column: e.target.value })}
                      aria-label={`Coluna para ${field.label}`}
                      className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    >
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  )}
                  {source.kind === "fixed" && (
                    <input
                      type="text"
                      value={source.value}
                      onChange={(e) => update(field.key, { kind: "fixed", value: e.target.value })}
                      placeholder={
                        field.type === "enum"
                          ? `Ex.: ${field.enumValues?.[0] ?? "valor"}`
                          : `Valor fixo para todas as linhas`
                      }
                      list={field.type === "enum" ? `enum-${field.key}` : undefined}
                      className="w-full max-w-xs rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />
                  )}
                  {field.type === "enum" && source.kind === "fixed" && (
                    <datalist id={`enum-${field.key}`}>
                      {field.enumValues?.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  )}
                  {source.kind === "none" && (
                    <span className="text-xs text-slate-400">
                      {field.required ? (
                        <span className="text-red-500">Obrigatório</span>
                      ) : (
                        "Não será enviado"
                      )}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        A <strong>Conta Bancária</strong> selecionada acima é enviada no campo{" "}
        <code className="rounded bg-slate-100 px-1">conta_financeira</code> de todas
        as baixas.
      </p>
    </div>
  );
}
