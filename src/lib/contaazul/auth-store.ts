import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de tokens OAuth2 do Conta Azul no servidor.
 *
 * - Memória: fonte da verdade em runtime.
 * - Arquivo `.cache/ca-tokens.json`: persistência best-effort para que o
 *   refresh token sobreviva a reinícios do dev server.
 *
 * Em produção multiusuário, substitua por um storage seguro
 * (banco de dados criptografado, secret manager etc.).
 */

export interface CaTokens {
  accessToken: string;
  refreshToken?: string;
  /** Timestamp (ms) em que o access token expira. */
  expiresAt?: number;
}

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "ca-tokens.json");

let memoryTokens: CaTokens | null = null;

export async function getTokens(): Promise<CaTokens | null> {
  if (memoryTokens) return memoryTokens;

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

export async function setTokens(tokens: CaTokens): Promise<void> {
  memoryTokens = tokens;
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

export async function clearTokens(): Promise<void> {
  memoryTokens = null;
  try {
    await fs.rm(CACHE_FILE, { force: true });
  } catch {
    // ignore
  }
}

export async function isConnected(): Promise<boolean> {
  const tokens = await getTokens();
  return Boolean(tokens?.accessToken);
}
