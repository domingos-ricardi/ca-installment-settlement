"use client";

import { formatCurrencyBrl, formatIsoDateBr } from "@/lib/format";
import type { EventoFinanceiro, ParcelaEvento } from "@/lib/types";

interface ParcelasPanelProps {
  loading: boolean;
  error: string | null;
  evento: EventoFinanceiro | null;
  parcelas: ParcelaEvento[];
  /** Id da parcela selecionada no dropdown (recebe destaque na lista). */
  parcelaSelecionadaId?: string;
  dataReferencia?: string | null;
}

/**
 * Painel de busca de parcelas: resume o evento financeiro selecionado e
 * lista todas as suas parcelas (índice, vencimento, status e valores),
 * permitindo conferir os alvos da importação antes do envio.
 */
export function ParcelasPanel({
  loading,
  error,
  evento,
  parcelas,
  parcelaSelecionadaId,
  dataReferencia,
}: ParcelasPanelProps) {
  if (loading) {
    return (
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Buscando parcelas do evento…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (!evento && parcelas.length === 0) return null;

  return (
    <div className="rounded-md border border-slate-200">
      {evento && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Evento</span>
          {evento.codigo_referencia && (
            <span>
              Código:{" "}
              <span className="font-mono text-slate-700">{evento.codigo_referencia}</span>
            </span>
          )}
          {evento.tipo && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
              {evento.tipo}
            </span>
          )}
          <span>
            Competência: <strong>{formatIsoDateBr(evento.data_competencia)}</strong>
          </span>
          <span>
            Parcelas: <strong>{evento.quantidade_parcelas ?? parcelas.length}</strong>
          </span>
          {dataReferencia && (
            <span className="text-emerald-700">
              Dia da importação: <strong>{formatIsoDateBr(dataReferencia)}</strong>
            </span>
          )}
        </div>
      )}

      <div className="max-h-56 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-white sticky top-0">
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">Vencimento</th>
              <th className="px-3 py-1.5 font-medium">Status</th>
              <th className="px-3 py-1.5 font-medium">Valor bruto</th>
              <th className="px-3 py-1.5 font-medium">Em aberto</th>
              <th className="px-3 py-1.5 font-medium">ID da parcela</th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((parcela) => {
              const destacada = parcela.id === parcelaSelecionadaId;
              return (
                <tr
                  key={parcela.id}
                  className={`border-b border-slate-50 last:border-0 ${
                    destacada ? "bg-blue-50/60" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 text-slate-600">{parcela.indice ?? "—"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                    {formatIsoDateBr(parcela.data_vencimento)}
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge status={parcela.status} />
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                    {formatCurrencyBrl(parcela.valor_bruto)}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                    {formatCurrencyBrl(parcela.nao_pago)}
                  </td>
                  <td
                    className="max-w-[240px] truncate px-3 py-1.5 font-mono text-slate-400"
                    title={parcela.id}
                  >
                    {parcela.id}
                    {destacada && (
                      <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        selecionada
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {parcelas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-2 text-slate-400">
                  Nenhuma parcela retornada para este evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? "—";
  const quitado = ["QUITADO", "RECEBIDO"].includes(label);
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-semibold ${
        quitado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}
