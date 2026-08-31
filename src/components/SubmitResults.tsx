"use client";

import type { BaixaResult } from "@/lib/types";

interface SubmitResultsProps {
  summary: {
    total: number;
    processados: number;
    sucessos: number;
    falhas: number;
    interrompido: boolean;
  };
  results: BaixaResult[];
}

/** Resumo do processamento em lote e detalhe das falhas. */
export function SubmitResults({ summary, results }: SubmitResultsProps) {
  const failures = results.filter((r) => !r.success);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Chip label="Enviadas" value={summary.total} tone="neutral" />
        <Chip label="Sucessos" value={summary.sucessos} tone="success" />
        <Chip label="Falhas" value={summary.falhas} tone={summary.falhas > 0 ? "danger" : "neutral"} />
        {summary.interrompido && (
          <Chip
            label="Lote interrompido (auth/rate limit)"
            value={`${summary.processados}/${summary.total}`}
            tone="warning"
          />
        )}
      </div>

      {failures.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-red-200">
          <table className="w-full text-xs">
            <thead className="bg-red-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-red-700">Parcela</th>
                <th className="px-3 py-2 text-left font-medium text-red-700">HTTP</th>
                <th className="px-3 py-2 text-left font-medium text-red-700">Erro</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((failure) => (
                <tr key={`${failure.index}-${failure.parcela_id}`} className="border-t border-red-100">
                  <td className="max-w-[280px] truncate px-3 py-1.5 font-mono text-slate-700">
                    {failure.parcela_id}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">{failure.status ?? "—"}</td>
                  <td className="px-3 py-1.5 text-slate-700">{failure.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "success" | "danger" | "warning";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    danger: "bg-red-100 text-red-800",
    warning: "bg-amber-100 text-amber-800",
  } as const;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}
