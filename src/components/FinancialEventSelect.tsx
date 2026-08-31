"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatCurrencyBrl, formatIsoDateBr } from "@/lib/format";
import { normalizeToken } from "@/lib/csv/converters";
import type { EventoTipo, LancamentoResumo } from "@/lib/types";

/** Limite de opções renderizadas no select (a busca textual filtra o resto). */
const MAX_OPTIONS = 300;

interface FinancialEventSelectProps {
  enabled: boolean;
  selectedId: string;
  tipo: EventoTipo;
  onTipoChange: (tipo: EventoTipo) => void;
  periodoDe: string;
  onPeriodoDeChange: (value: string) => void;
  periodoAte: string;
  onPeriodoAteChange: (value: string) => void;
  onSelect: (lancamentoId: string) => void;
}

/**
 * Dropdown de Evento Financeiro: lista lançamentos (contas a receber/pagar)
 * do Conta Azul por faixa de vencimento. A seleção determina o evento da
 * importação e a data usada para filtrar as linhas do CSV.
 */
export function FinancialEventSelect({
  enabled,
  selectedId,
  tipo,
  onTipoChange,
  periodoDe,
  onPeriodoDeChange,
  periodoAte,
  onPeriodoAteChange,
  onSelect,
}: FinancialEventSelectProps) {
  const [itens, setItens] = useState<LancamentoResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const primeiraCargaRef = useRef(false);

  const fetchLancamentos = useCallback(async (): Promise<void> => {
    if (!periodoDe || !periodoAte) {
      setError("Informe o período de vencimento.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tipo,
        de: periodoDe,
        ate: periodoAte,
      });
      const response = await fetch(`/api/eventos-financeiros?${params.toString()}`);
      if (response.status === 401) {
        setItens([]);
        setError("Conecte-se à Conta Azul para listar os eventos financeiros.");
        return;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erro HTTP ${response.status}`);
      }
      const data = (await response.json()) as { itens: LancamentoResumo[] };
      setItens(data.itens ?? []);
    } catch (err) {
      setItens([]);
      setError(err instanceof Error ? err.message : "Falha ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  }, [periodoAte, periodoDe, tipo]);

  // Primeira carga automática quando conectado; depois disso, busca manual.
  useEffect(() => {
    if (!enabled || primeiraCargaRef.current) return;
    primeiraCargaRef.current = true;
    void fetchLancamentos();
  }, [enabled, fetchLancamentos]);

  const filtrados = useMemo(() => {
    const termo = normalizeToken(busca);
    const base = termo.length === 0
      ? itens
      : itens.filter((item) =>
          normalizeToken(
            `${item.descricao ?? ""} ${item.data_vencimento ?? ""} ${item.status ?? ""}`,
          ).includes(termo),
        );
    return base.slice(0, MAX_OPTIONS);
  }, [itens, busca]);

  const totalOculto = itens.length - filtrados.length;

  return (
    <div>
      <label
        htmlFor="evento-financeiro"
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Evento Financeiro <span className="text-red-500">*</span>
      </label>

      {/* Filtros de listagem */}
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="evento-tipo" className="block text-xs text-slate-500">
            Tipo
          </label>
          <select
            id="evento-tipo"
            value={tipo}
            onChange={(e) => {
              primeiraCargaRef.current = false;
              onTipoChange(e.target.value as EventoTipo);
            }}
            disabled={!enabled}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
          >
            <option value="RECEITA">Contas a receber</option>
            <option value="DESPESA">Contas a pagar</option>
          </select>
        </div>
        <div>
          <label htmlFor="periodo-de" className="block text-xs text-slate-500">
            Vencimento de
          </label>
          <input
            id="periodo-de"
            type="date"
            value={periodoDe}
            onChange={(e) => onPeriodoDeChange(e.target.value)}
            disabled={!enabled}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
          />
        </div>
        <div>
          <label htmlFor="periodo-ate" className="block text-xs text-slate-500">
            até
          </label>
          <input
            id="periodo-ate"
            type="date"
            value={periodoAte}
            onChange={(e) => onPeriodoAteChange(e.target.value)}
            disabled={!enabled}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchLancamentos()}
          disabled={!enabled || loading}
          title="Buscar lançamentos no período"
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {loading ? "Buscando…" : "⟳ Buscar"}
        </button>
        {itens.length > 0 && (
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por descrição…"
            className="w-44 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <select
          id="evento-financeiro"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          disabled={!enabled || loading}
          className="w-full max-w-2xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">
            {loading
              ? "Carregando eventos financeiros…"
              : itens.length === 0
                ? "Nenhum evento carregado"
                : "Selecione o evento financeiro da importação…"}
          </option>
          {filtrados.map((item) => (
            <option key={item.id} value={item.id}>
              {formatOptionLabel(item)}
            </option>
          ))}
        </select>
      </div>

      {!enabled && (
        <p className="mt-1 text-xs text-slate-400">
          Conecte-se à Conta Azul para listar os eventos financeiros.
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}{" "}
          {enabled && (
            <button
              type="button"
              onClick={() => void fetchLancamentos()}
              className="underline"
            >
              Tentar novamente
            </button>
          )}
        </p>
      )}
      {totalOculto > 0 && (
        <p className="mt-1 text-xs text-amber-600">
          Exibindo {filtrados.length} de {itens.length} lançamentos — refine a busca
          para ver os demais.
        </p>
      )}
    </div>
  );
}

function formatOptionLabel(item: LancamentoResumo): string {
  const partes = [
    item.descricao ?? "(sem descrição)",
    `venc. ${formatIsoDateBr(item.data_vencimento)}`,
    formatCurrencyBrl(item.total),
  ];
  if (item.status) partes.push(item.status);
  return partes.join(" · ");
}
