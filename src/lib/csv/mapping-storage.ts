import { normalizeToken } from "@/lib/csv/converters";
import type { EventoTipo, FieldMapping } from "@/lib/types";

/**
 * Persistência local (localStorage) do mapeamento CSV → payload e das
 * seleções da tela (conta bancária, evento financeiro e filtro do dia).
 *
 * O mapeamento é indexado por uma assinatura canônica das colunas do CSV:
 * arquivos diferentes com o mesmo layout reaproveitam o mapeamento salvo,
 * permitindo repetir a importação apenas trocando o evento financeiro.
 *
 * Todas as operações são tolerantes a falhas (SSR, storage indisponível,
 * JSON corrompido): degradam silenciosamente sem quebrar a aplicação.
 */

const STORAGE_KEY = "api-ca:persistence:v1";

/** Máximo de mapeamentos guardados (evict LRU pelo mais antigo). */
const MAX_MAPPINGS = 20;

export interface PersistedSelections {
  contaFinanceiraId?: string;
  lancamentoId?: string;
  eventoTipo?: EventoTipo;
  /** Data AAAA-MM-DD usada no filtro "somente o dia do evento". */
  filterDate?: string;
  dayFilterEnabled?: boolean;
  /**
   * Coluna do CSV cujo valor é comparado com `filterDate` no filtro
   * "somente o dia do evento" (em vez do campo Data do Pagamento).
   */
  filterColumn?: string;
}

interface MappingEntry {
  mapping: FieldMapping;
  savedAt: number;
}

interface StoreShape {
  mappings: Record<string, MappingEntry>;
  selections: PersistedSelections;
}

function emptyStore(): StoreShape {
  return { mappings: {}, selections: {} };
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStore(): StoreShape {
  const storage = getStorage();
  if (!storage) return emptyStore();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      mappings: parsed.mappings ?? {},
      selections: parsed.selections ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota excedida ou storage bloqueado — persistência é best-effort.
  }
}

/* -------------------------------------------------------------------------- */
/* Mapeamento por assinatura de colunas                                        */
/* -------------------------------------------------------------------------- */

/**
 * Assinatura canônica das colunas: ignora acentos, caixa e espaços, então
 * "Data de Pagamento" e "data_de_pagamento" compartilham o mesmo mapeamento.
 */
export function columnSignature(columns: string[]): string {
  return columns.map((column) => normalizeToken(column)).join("|");
}

/** Referências de coluna válidas (coluna existe no CSV atual)? */
export function isMappingUsable(mapping: FieldMapping, columns: string[]): boolean {
  const available = new Set(columns);
  for (const source of Object.values(mapping)) {
    if (!source || source.kind !== "column") continue;
    if (!available.has(source.column)) return false;
  }
  return true;
}

/**
 * Recupera o mapeamento salvo para estas colunas. Retorna `null` quando não
 * há mapeamento ou quando alguma coluna referenciada deixou de existir —
 * nesse caso a tela cai no auto-map, evitando payload quebrado.
 */
export function loadStoredMapping(
  signature: string,
  columns: string[],
): FieldMapping | null {
  const store = readStore();
  const entry = store.mappings[signature];
  if (!entry?.mapping) return null;
  if (!isMappingUsable(entry.mapping, columns)) return null;
  return entry.mapping;
}

/** Salva (ou substitui) o mapeamento destas colunas, aplicando limite LRU. */
export function saveMappingForSignature(
  signature: string,
  mapping: FieldMapping,
): void {
  const store = readStore();
  store.mappings[signature] = { mapping, savedAt: Date.now() };

  // Evict LRU: ordena do mais antigo para o mais novo e remove do início.
  // Em empates de timestamp, a ordem de inserção preservada pelo objeto
  // garante que os mais antigos sejam removidos primeiro.
  const ordenados = Object.entries(store.mappings).sort(
    ([, a], [, b]) => a.savedAt - b.savedAt,
  );
  while (ordenados.length > MAX_MAPPINGS) {
    ordenados.shift();
  }
  store.mappings = Object.fromEntries(ordenados);

  writeStore(store);
}

/* -------------------------------------------------------------------------- */
/* Seleções da tela                                                            */
/* -------------------------------------------------------------------------- */

export function loadSelections(): PersistedSelections {
  return readStore().selections;
}

/** Mescla as seleções informadas sobre as já persistidas. */
export function saveSelections(patch: PersistedSelections): void {
  const store = readStore();
  store.selections = { ...store.selections, ...patch };
  writeStore(store);
}
