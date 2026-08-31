import "server-only";

import { caConfig } from "@/lib/config";
import { getTokens, setTokens, type CaTokens } from "@/lib/contaazul/auth-store";
import { buildAuthorizeUrl } from "@/lib/contaazul/authorize-url";

/**
 * Cliente HTTP para a API v2 do Conta Azul.
 * - Injeta `Authorization: Bearer` automaticamente.
 * - Renova o access token via refresh token ao receber 401 (uma tentativa).
 */

export class CaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "CaApiError";
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Monta a URL de autorização OAuth2 (Authorization Code).
 *
 * A URL oficial contém um fragmento (`#/oauth/authorize`); os parâmetros são
 * anexados ao fragmento (após o `#`), NÃO a um query string HTTP real.
 *
 * IMPORTANTE: dentro de um fragmento de URL, os valores dos parâmetros devem
 * ir "brutos" (não percent-encoded), exatamente como mostra a documentação:
 *   https://login.contaazul.com/#/oauth/authorize?response_type=code&client_id=...&redirect_uri=https://...&state=...&scope=...
 *
 * Usar `URLSearchParams` percent-encoda o `redirect_uri` (ex. `://` → `%3A%2F%2F`),
 * o que faz o servidor/autorizador da Conta Azul rejeitar a requisição com
 * `invalid_request` (parâmetros "ausentes" ou "inválidos"). Por isso montamos
 * a string manualmente, sem URL-encode — os parâmetros aqui (client_id,
 * redirect_uri, state, scope) são seguros para exibição bruta no fragmento.
 */
export { buildAuthorizeUrl };

function basicAuthHeader(): string {
  const credentials = Buffer.from(
    `${caConfig.clientId}:${caConfig.clientSecret}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

async function requestToken(form: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(caConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const body = await safeJson(response);
    throw new CaApiError(
      `Falha ao obter token na Conta Azul (HTTP ${response.status}).`,
      response.status,
      body,
    );
  }

  return (await response.json()) as TokenResponse;
}

/**
 * Troca o código de autorização pelo par de tokens.
 * `redirectUri` é opcional: alguns fluxos de app de Desenvolvimento
 * não exigem o parâmetro na troca.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri?: string,
): Promise<CaTokens> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
  });
  if (redirectUri) {
    form.set("redirect_uri", redirectUri);
  }
  const data = await requestToken(form);
  return toCaTokens(data);
}

/** Renova o access token usando o refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<CaTokens> {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const data = await requestToken(form);
  return toCaTokens(data);
}

function toCaTokens(data: TokenResponse): CaTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

/**
 * Executa uma requisição autenticada à API do Conta Azul.
 * Em caso de 401 com refresh token disponível, renova o token e tenta novamente.
 */
export async function caFetch<T>(
  pathWithQuery: string,
  init: RequestInit = {},
): Promise<T> {
  let tokens = await getTokens();
  if (!tokens?.accessToken) {
    throw new CaApiError("Não autenticado: conecte-se à Conta Azul primeiro.", 401);
  }

  const doFetch = (accessToken: string) =>
    fetch(`${caConfig.apiBaseUrl}${pathWithQuery}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

  let response = await doFetch(tokens.accessToken);

  if (response.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    await setTokens(refreshed);
    tokens = refreshed;
    response = await doFetch(refreshed.accessToken);
  }

  if (!response.ok) {
    const body = await safeJson(response);
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as Record<string, unknown>).detail)
        : JSON.stringify(body)?.slice(0, 500);
    throw new CaApiError(
      `Erro na API Conta Azul (HTTP ${response.status}): ${detail ?? response.statusText}`,
      response.status,
      body,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
