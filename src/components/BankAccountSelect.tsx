"use client";

import { useCallback, useEffect, useState } from "react";

import type { ContaFinanceira } from "@/lib/types";

interface BankAccountSelectProps {
  value: string;
  onChange: (contaId: string) => void;
  enabled: boolean;
}

/** Dropdown de Conta Bancária carregado da API do Conta Azul. */
export function BankAccountSelect({ value, onChange, enabled }: BankAccountSelectProps) {
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  /** Busca as contas; todos os setState ocorrem após `await`. */
  const fetchContas = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/bank-accounts");
      if (response.status === 401) {
        setContas([]);
        setError("Conecte-se à Conta Azul para listar as contas bancárias.");
        return;
      }
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Erro HTTP ${response.status}`);
      }
      const data = (await response.json()) as { itens: ContaFinanceira[] };
      setContas(data.itens ?? []);
      setError(null);
    } catch (err) {
      setContas([]);
      setError(err instanceof Error ? err.message : "Falha ao carregar contas.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Recarga manual (botão ⟳): reexibe o estado de carregando. */
  const reload = useCallback(async () => {
    setLoading(true);
    await fetchContas();
  }, [fetchContas]);

  // Carrega ao conectar (padrão da documentação React: fetch com flag de ignorar).
  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    async function startFetching() {
      await fetchContas();
      if (ignore) return;
    }
    void startFetching();
    return () => {
      ignore = true;
    };
  }, [enabled, fetchContas]);

  return (
    <div>
      <label
        htmlFor="conta-bancaria"
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        Conta Bancária <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-2">
        <select
          id="conta-bancaria"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!enabled || loading || contas.length === 0}
          className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">
            {loading
              ? "Carregando contas…"
              : contas.length === 0
                ? "Nenhuma conta disponível"
                : "Selecione a conta bancária…"}
          </option>
          {contas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {formatConta(conta)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={!enabled || loading}
          title="Recarregar contas"
          className="rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ⟳
        </button>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}{" "}
          {enabled && (
            <button type="button" onClick={() => void reload()} className="underline">
              Tentar novamente
            </button>
          )}
        </p>
      )}
    </div>
  );
}

function formatConta(conta: ContaFinanceira): string {
  const parts = [conta.nome];
  if (conta.banco) parts.push(conta.banco.replaceAll("_", " "));
  if (conta.agencia || conta.numero) {
    parts.push([conta.agencia, conta.numero].filter(Boolean).join(" / "));
  }
  if (conta.conta_padrao) parts.push("(padrão)");
  return parts.join(" · ");
}
