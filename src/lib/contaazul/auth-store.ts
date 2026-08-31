import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de tokens OAuth2 do Conta Azul no servidor.
 *
 * O armazenamento é PLUGÁVEL para funcionar corretamente em diferentes
 * ambientes:
 *
 * 1. **Vercel KV / Upstash Redis** (produção no Vercel): usado quando as
 *    variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` estão definidas.
 *    Este é o único storage que persiste entre as instâncias serverless do
 *    Vercel — memória e arquivo são efêmeros/read-only nesse runtime, então
 *    sem ele os tokens se perdem entre requisições (falling em 401 ao enviar
 *    baixas após buscar eventos).
 *
 * 2. **Memória + arquivo `.cache/ca-tokens.json`** (dev local / fallback):
 *    persistência best-effort para que o refresh token sobreviva a reinícios
 *    do dev server.
 *
 * Em produção multiusuário, prefira um storage seguro dedicado por usuário
 * (banco de dados criptografado, secret manager etc.).
 */

export interface CaTokens {
  accessToken: string;
  refreshToken?: string;
  /** Timestamp (ms) em que o access token expira. */
  expiresAt?: number;
}

/* -------------------------------------------------------------------------- */
/* Vercel KV / Upstash Redis (via API REST) — único storage serverless-safe   */
/* -------------------------------------------------------------------------- */

const KV_REST_API_URL = process.env.KV_REST_API_URL ?? "";
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN ?? "";
/** Chave que guarda os tokens no KV. */
const KV_KEY = "ca_tokens";
/** TTL (s) opcional para a chave; evita dados obsoletos. Padrão 30 dias. */
const KV_TTL_SECONDS = Number(
  process.env.CA_TOKENS_KV_TTL_SECONDS || String(60 * 60 * 24 * 30),
);

function kvConfigured(): boolean {
  return KV_REST_API_URL.length > 0 && KV_REST_API_TOKEN.length > 0;
}

/**
 * Executa um comando da API REST do Upstash Redis (usada pelo Vercel KV).
 * Segue o contrato `https://<url>/<command>/<arg1>/<arg2>` com header
 * `Authorization: Bearer <KV_REST_API_TOKEN>`.
 * A resposta é `{ result: <valor> }` ou `{ error: <mensagem> }`.
 */
async function kvCommand(
  command: string,
  args: string[],
): Promise<{ result?: unknown; error?: string }> {
  const url = `${KV_REST_API_URL}/${command}/${args
    .map((a) => encodeURIComponent(a))
    .join("/")}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`KV ${command} falhou (HTTP ${response.status})`);
  }
  const body = (await response.json()) as { result?: unknown; error?: string };
  if (body.error) {
    throw new Error(`KV ${command} erro: ${body.error}`);
  }
  return body;
}

async function kvGetTokens(): Promise<CaTokens | null> {
  const { result } = await kvCommand("get", [KV_KEY]);
  if (typeof result !== "string" || result.length === 0) return null;
  try {
    const parsed = JSON.parse(result) as CaTokens;
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

async function kvSetTokens(tokens: CaTokens): Promise<void> {
  const value = JSON.stringify(tokens);
  if (KV_TTL_SECONDS > 0) {
    await kvCommand("setex", [KV_KEY, String(KV_TTL_SECONDS), value]);
  } else {
    await kvCommand("set", [KV_KEY, value]);
  }
}

async function kvClearTokens(): Promise<void> {
  await kvCommand("del", [KV_KEY]);
}

/* -------------------------------------------------------------------------- */
/* Fallback: memória + arquivo local (dev/ambientes com filesystem persistente)*/
/* -------------------------------------------------------------------------- */

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "ca-tokens.json");

let memoryTokens: CaTokens | null = null;

async function fileGetTokens(): Promise<CaTokens | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as CaTokens;
    if (parsed?.accessToken) {
      memoryTokens = parsed;
      return memoryTokens;
    }
  } catch {
    // Sem cache em disco — fluxo normal no primeiro uso.
  }
  return null;
}

async function fileSetTokens(tokens: CaTokens): Promise<void> {
  try {
    // O cache contém credenciais de acesso à conta Conta Azul: diretório e
    // arquivo ficam restritos ao usuário do processo.
    await fs.mkdir(CACHE_DIR, { recursive: true, mode: 0o700 });
    await fs.chmod(CACHE_DIR, 0o700); // cobre diretórios pré-existentes
    await fs.writeFile(CACHE_FILE, JSON.stringify(tokens, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    // `mode` só é aplicado na criação do arquivo; o chmod garante a restrição
    // mesmo quando o arquivo já existia com permissões mais amplas.
    await fs.chmod(CACHE_FILE, 0o600);
  } catch {
    // Persistência é best-effort; memória continua válida.
  }
}

async function fileClearTokens(): Promise<void> {
  try {
    await fs.rm(CACHE_FILE, { force: true });
  } catch {
    // ignore
  }
}

/* -------------------------------------------------------------------------- */
/* API pública — despacha para o storage conforme o ambiente                  */
/* -------------------------------------------------------------------------- */

export async function getTokens(): Promise<CaTokens | null> {
  if (kvConfigured()) {
    // Não usa `memoryTokens`: em serverless cada instância é efêmera e a fonte
    // de verdade precisa ser o KV compartilhado.
    return kvGetTokens().catch(() => null);
  }
  if (memoryTokens) return memoryTokens;
  return fileGetTokens();
}

export async function setTokens(tokens: CaTokens): Promise<void> {
  if (kvConfigured()) {
    return kvSetTokens(tokens).catch(() => {
      // Best-effort: se o KV falhar, tenta o fallback em disco.
      void fileSetTokens(tokens);
    });
  }
  memoryTokens = tokens;
  return fileSetTokens(tokens);
}

export async function clearTokens(): Promise<void> {
  if (kvConfigured()) {
    try {
      await kvClearTokens();
    } catch {
      // ignore
    }
  }
  memoryTokens = null;
  return fileClearTokens();
}

export async function isConnected(): Promise<boolean> {
  const tokens = await getTokens();
  return Boolean(tokens?.accessToken);
}
