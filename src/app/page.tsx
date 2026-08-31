"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BankAccountSelect } from "@/components/BankAccountSelect";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { CsvPreviewGrid } from "@/components/CsvPreviewGrid";
import { CsvUploader } from "@/components/CsvUploader";
import { FieldMappingPanel } from "@/components/FieldMappingPanel";
import { FinancialEventSelect } from "@/components/FinancialEventSelect";
import { ParcelasPanel } from "@/components/ParcelasPanel";
import { SubmitResults } from "@/components/SubmitResults";
import { suggestMapping } from "@/lib/csv/auto-map";
import { isRowInFilterDay, resolveFilterColumn } from "@/lib/csv/day-filter";
import {
  columnSignature,
  loadSelections,
  loadStoredMapping,
  saveMappingForSignature,
  saveSelections,
} from "@/lib/csv/mapping-storage";
import { buildBaixaPayload } from "@/lib/csv/payload-builder";
import { applyFixedParcelaId } from "@/lib/csv/mapping-utils";
import { formatIsoDateBr, isoDaysFromToday } from "@/lib/format";
import type {
  BaixaItemInput,
  BaixaResult,
  CsvData,
  EventoFinanceiro,
  EventoTipo,
  FieldMapping,
  ParcelaEvento,
} from "@/lib/types";

interface BaixasApiResponse {
  total: number;
  processados: number;
  sucessos: number;
  falhas: number;
  interrompido: boolean;
  results: BaixaResult[];
}

interface EventoInfoResponse {
  evento: EventoFinanceiro | null;
  parcela_selecionada_id?: string;
  parcelas: ParcelaEvento[];
  data_referencia?: string | null;
}

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [mappingRestaurado, setMappingRestaurado] = useState(false);
  const [contaId, setContaId] = useState("");
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<BaixasApiResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Evento financeiro da importação.
  const [eventoTipo, setEventoTipo] = useState<EventoTipo>("RECEITA");
  const [periodoDe, setPeriodoDe] = useState(() => isoDaysFromToday(-30));
  const [periodoAte, setPeriodoAte] = useState(() => isoDaysFromToday(30));
  const [lancamentoId, setLancamentoId] = useState("");
  const [evento, setEvento] = useState<EventoFinanceiro | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaEvento[]>([]);
  const [parcelaSelecionadaId, setParcelaSelecionadaId] = useState("");
  const [parcelasLoading, setParcelasLoading] = useState(false);
  const [parcelasErro, setParcelasErro] = useState<string | null>(null);

  // Filtro "somente o dia do evento".
  const [filterDate, setFilterDate] = useState("");
  const [dayFilterEnabled, setDayFilterEnabled] = useState(true);
  // Coluna do CSV usada como base do filtro (em vez do campo Data do Pagamento).
  const [filterColumn, setFilterColumn] = useState("");

  // Seleções restauradas do localStorage (aplicadas uma única vez).
  const restoredRef = useRef(false);
  const autoFetchParcelasRef = useRef<string | null>(null);

  // Restaura mapeamentos/seleções persistidos ao montar (client-side).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    // Leitura do storage fora do corpo síncrono do effect (mesmo padrão do
    // ConnectionBanner: setState após await, sem render em cascata).
    void Promise.resolve().then(() => {
      const selections = loadSelections();
      if (selections.contaFinanceiraId) setContaId(selections.contaFinanceiraId);
      if (selections.eventoTipo === "RECEITA" || selections.eventoTipo === "DESPESA") {
        setEventoTipo(selections.eventoTipo);
      }
      if (selections.filterDate) setFilterDate(selections.filterDate);
      if (typeof selections.dayFilterEnabled === "boolean") {
        setDayFilterEnabled(selections.dayFilterEnabled);
      }
      if (selections.filterColumn) setFilterColumn(selections.filterColumn);
      if (selections.lancamentoId) {
        setLancamentoId(selections.lancamentoId);
        // Busca as parcelas assim que a conexão estiver ativa.
        autoFetchParcelasRef.current = selections.lancamentoId;
      }
    });
  }, []);

  // Persistência das seleções da tela.
  useEffect(() => {
    saveSelections({ contaFinanceiraId: contaId || undefined });
  }, [contaId]);
  useEffect(() => {
    saveSelections({ eventoTipo });
  }, [eventoTipo]);
  useEffect(() => {
    saveSelections({
      filterDate: filterDate || undefined,
      dayFilterEnabled,
      filterColumn: filterColumn || undefined,
      lancamentoId: lancamentoId || undefined,
    });
  }, [filterDate, dayFilterEnabled, filterColumn, lancamentoId]);

  /** Busca o evento + parcelas do lançamento selecionado (busca de parcelas). */
  const carregarEvento = useCallback(async (id: string) => {
    setParcelasLoading(true);
    setParcelasErro(null);
    try {
      const res = await fetch(
        `/api/eventos-financeiros/parcelas?parcelaId=${encodeURIComponent(id)}`,
      );
      const data = (await res.json().catch(() => ({}))) as EventoInfoResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Erro HTTP ${res.status}`);

      setEvento(data.evento ?? null);
      setParcelas(data.parcelas ?? []);
      const parcelaId = data.parcela_selecionada_id ?? id;
      setParcelaSelecionadaId(parcelaId);

      // Todas as linhas do dia pertencem à mesma parcela: preenche o campo
      // "ID da Parcela" como Valor Fixo automaticamente.
      setMapping((prev) => applyFixedParcelaId(prev, parcelaId));

      // O dia do evento passa a filtrar automaticamente o CSV.
      if (data.data_referencia) {
        setFilterDate(data.data_referencia);
        setDayFilterEnabled(true);
      }
    } catch (err) {
      setEvento(null);
      setParcelas([]);
      setParcelasErro(err instanceof Error ? err.message : "Falha ao buscar parcelas.");
    } finally {
      setParcelasLoading(false);
    }
  }, []);

  // Após conectar, conclui a restauração do evento selecionado anteriormente.
  useEffect(() => {
    if (!connected) return;
    const pendente = autoFetchParcelasRef.current;
    if (!pendente) return;
    autoFetchParcelasRef.current = null;
    void carregarEvento(pendente);
  }, [connected, carregarEvento]);

  function handleSelecionarLancamento(id: string) {
    setLancamentoId(id);
    if (!id) {
      setEvento(null);
      setParcelas([]);
      setParcelaSelecionadaId("");
      setParcelasErro(null);
      // Remove o valor fixo de parcela_id vinculado ao evento desmarcado
      // (mapeamento por coluna do usuário é preservado).
      setMapping((prev) => applyFixedParcelaId(prev, null));
      return;
    }
    void carregarEvento(id);
  }

  // Limpa estado dependente do CSV ao carregar um novo arquivo,
  // restaurando o mapeamento salvo para este layout de colunas.
  const handleCsvData = useCallback((data: CsvData) => {
    setCsvData(data);
    const signature = columnSignature(data.columns);
    const storedMapping = loadStoredMapping(signature, data.columns);
    // Um parcela_id fixo salvo pode referenciar um evento antigo — a origem
    // confiável é o evento financeiro atualmente selecionado na tela.
    const base = storedMapping
      ? applyFixedParcelaId(storedMapping, null)
      : suggestMapping(data.columns);
    setMapping(lancamentoId ? applyFixedParcelaId(base, lancamentoId) : base);
    // Coluna base do filtro do dia: mantém a escolhida antes (se existir no
    // CSV), senão a mapeada para Data do Pagamento, senão um campo de data.
    setFilterColumn(resolveFilterColumn(data.columns, base, loadSelections().filterColumn));
    setMappingRestaurado(storedMapping !== null);
    setExcludedRows(new Set());
    setResponse(null);
    setSubmitError(null);
  }, [lancamentoId]);

  // Persiste o mapeamento sempre que mudar (por layout de colunas).
  useEffect(() => {
    if (!csvData) return;
    saveMappingForSignature(columnSignature(csvData.columns), mapping);
  }, [csvData, mapping]);

  function toggleRow(index: number) {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const dayFilterAtivo =
    dayFilterEnabled && filterDate.length > 0 && filterColumn.length > 0;

  // Validação por linha (para colorir a grid).
  const rowErrors = useMemo(() => {
    if (!csvData) return [];
    return csvData.rows.map(
      (row) => buildBaixaPayload(row, mapping, contaId || "00000000-0000-0000-0000-000000000000").errors,
    );
  }, [csvData, mapping, contaId]);

  // Linhas válidas porém fora do dia do evento (exibidas como "Fora do dia").
  // O valor comparado vem da COLUNA escolhida no CSV (`filterColumn`), não do
  // campo "Data do Pagamento" do payload — datas são normalizadas para ISO.
  const outOfDayRows = useMemo(() => {
    const set = new Set<number>();
    if (!csvData || !dayFilterAtivo || !filterColumn) return set;
    csvData.rows.forEach((row, index) => {
      if (excludedRows.has(index)) return;
      if (!isRowInFilterDay(row, filterColumn, filterDate)) set.add(index);
    });
    return set;
  }, [csvData, dayFilterAtivo, excludedRows, filterDate, filterColumn]);

  // Payloads prontos das linhas incluídas, válidas e dentro do dia filtrado.
  const readyPayloads = useMemo(() => {
    if (!csvData) return [] as { rowIndex: number; item: BaixaItemInput }[];
    const payloads: { rowIndex: number; item: BaixaItemInput }[] = [];
    csvData.rows.forEach((row, index) => {
      if (excludedRows.has(index) || outOfDayRows.has(index)) return;
      const { payload } = buildBaixaPayload(row, mapping, contaId);
      if (!payload) return;
      const { parcela_id, ...rest } = payload;
      payloads.push({ rowIndex: index, item: { parcela_id, ...rest } });
    });
    return payloads;
  }, [csvData, mapping, contaId, excludedRows, outOfDayRows]);

  const resultsByRow = useMemo(() => {
    const map = new Map<number, BaixaResult>();
    response?.results.forEach((result, position) => {
      const entry = readyPayloads[position];
      if (entry) map.set(entry.rowIndex, result);
    });
    return map;
  }, [response, readyPayloads]);

  const canSubmit =
    connected && contaId.length > 0 && readyPayloads.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setResponse(null);

    try {
      const apiResponse = await fetch("/api/baixas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conta_financeira: contaId,
          items: readyPayloads.map(({ item }) => item),
        }),
      });

      if (!apiResponse.ok) {
        const data = (await apiResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Erro HTTP ${apiResponse.status}`);
      }

      setResponse((await apiResponse.json()) as BaixasApiResponse);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Importador de Baixas · Conta Azul
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Carregue um CSV, selecione o evento financeiro, confirme o mapeamento e
              envie em lote apenas as baixas do dia correspondente.
            </p>
          </div>
          <form action="/api/session/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <ConnectionBanner onStatusChange={(status) => setConnected(status.connected)} />

      {/* 1. Upload do CSV */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          1 · Arquivo CSV
        </h2>
        <CsvUploader onData={handleCsvData} />
      </section>

      {/* 2. Configuração do payload */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          2 · Configuração do Payload de Baixa
        </h2>
        <div className="space-y-5">
          <FinancialEventSelect
            enabled={connected}
            selectedId={lancamentoId}
            tipo={eventoTipo}
            onTipoChange={setEventoTipo}
            periodoDe={periodoDe}
            onPeriodoDeChange={setPeriodoDe}
            periodoAte={periodoAte}
            onPeriodoAteChange={setPeriodoAte}
            onSelect={handleSelecionarLancamento}
          />

          {(parcelasLoading || parcelasErro || evento || parcelas.length > 0) && (
            <ParcelasPanel
              loading={parcelasLoading}
              error={parcelasErro}
              evento={evento}
              parcelas={parcelas}
              parcelaSelecionadaId={parcelaSelecionadaId}
              dataReferencia={dayFilterAtivo ? filterDate : null}
            />
          )}

          {/* Filtro do dia do evento */}
          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={dayFilterEnabled}
                onChange={(e) => setDayFilterEnabled(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Enviar somente linhas do dia
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              {csvData && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  Filtrar pela coluna:
                  <select
                    value={filterColumn}
                    onChange={(e) => setFilterColumn(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— selecione a coluna —</option>
                    {csvData.columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {dayFilterEnabled && filterDate.length > 0 && !filterColumn && (
              <p className="mt-2 text-xs text-amber-600">
                Selecione a coluna do CSV usada como data para aplicar o filtro
                (não é usado o campo Data do Pagamento).
              </p>
            )}
            {dayFilterAtivo ? (
              <span className="mt-2 block text-xs text-emerald-700">
                Apenas baixas com a coluna{" "}
                <strong>{filterColumn}</strong> em{" "}
                <strong>{formatIsoDateBr(filterDate)}</strong> serão enviadas.
              </span>
            ) : (
              <span className="mt-2 block text-xs text-slate-500">
                Sem filtro — todas as linhas válidas serão enviadas.
              </span>
            )}
            {!lancamentoId && (
              <p className="mt-1 text-xs text-slate-400">
                Ao selecionar um evento financeiro, este campo é preenchido
                automaticamente com a data dele.
              </p>
            )}
          </div>

          <BankAccountSelect value={contaId} onChange={setContaId} enabled={connected} />

          {csvData ? (
            <>
              {mappingRestaurado && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Mapeamento restaurado da última importação com este layout de
                  colunas — ajuste se necessário.
                </p>
              )}
              <FieldMappingPanel columns={csvData.columns} mapping={mapping} onChange={(m) => {
                setMapping(m);
                setMappingRestaurado(false);
              }} />
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Carregue um arquivo CSV para configurar o mapeamento dos campos.
            </p>
          )}
        </div>
      </section>

      {/* 3. Grid de pré-visualização */}
      {csvData && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              3 · Pré-visualização ({csvData.rows.length} linhas)
            </h2>
            <p className="text-xs text-slate-500">
              {readyPayloads.length} prontas ·{" "}
              {rowErrors.filter((e) => e.length > 0).length} com erro ·{" "}
              {dayFilterAtivo ? `${outOfDayRows.size} fora do dia · ` : ""}
              {excludedRows.size} ignoradas
            </p>
          </div>
          <CsvPreviewGrid
            csvData={csvData}
            mapping={mapping}
            rowErrors={rowErrors}
            excludedRows={excludedRows}
            outOfDayRows={outOfDayRows}
            onToggleRow={toggleRow}
            resultsByRow={resultsByRow}
          />
        </section>
      )}

      {/* 4. Revisão e envio */}
      {csvData && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            4 · Revisão e Envio
          </h2>

          <details className="mb-4 rounded-md border border-slate-200">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
              Pré-visualizar JSON gerado ({readyPayloads.length} baixas)
            </summary>
            <pre className="max-h-72 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {JSON.stringify(
                readyPayloads.slice(0, 3).map(({ item }) => item),
                null,
                2,
              )}
              {readyPayloads.length > 3 && "\n… (exibindo as 3 primeiras)"}
            </pre>
          </details>

          {!connected && (
            <p className="mb-3 text-sm text-amber-600">
              Conecte-se à Conta Azul para habilitar o envio.
            </p>
          )}
          {connected && !contaId && (
            <p className="mb-3 text-sm text-amber-600">
              Selecione a conta bancária de destino.
            </p>
          )}
          {connected && contaId && readyPayloads.length === 0 && outOfDayRows.size > 0 && (
            <p className="mb-3 text-sm text-amber-600">
              Nenhuma linha em {formatIsoDateBr(filterDate)} — ajuste o filtro do dia
              ou o CSV ({outOfDayRows.size} linhas fora do dia).
            </p>
          )}
          {connected && contaId && readyPayloads.length === 0 && outOfDayRows.size === 0 && (
            <p className="mb-3 text-sm text-amber-600">
              Nenhuma linha válida para enviar — verifique os erros na grid.
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors ${
              canSubmit
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {submitting
              ? "Enviando baixas…"
              : `Enviar ${readyPayloads.length} baixa${readyPayloads.length === 1 ? "" : "s"}`}
          </button>

          {submitting && (
            <p className="mt-2 text-xs text-slate-500">
              Processando sequencialmente com intervalo entre chamadas — não feche a página.
            </p>
          )}
          {submitError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {submitError}
            </p>
          )}
        </section>
      )}

      {/* 5. Resultado */}
      {response && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            5 · Resultado do Envio
          </h2>
          <SubmitResults summary={response} results={response.results} />
        </section>
      )}

      <footer className="pb-4 text-center text-xs text-slate-400">
        Documentação oficial: developers.contaazul.com · API v2
      </footer>
    </main>
  );
}
