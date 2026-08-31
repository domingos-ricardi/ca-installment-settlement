import { caConfig } from "@/lib/config";

/**
 * Monta a URL de autorização OAuth2 (Authorization Code) — função pura,
 * sem dependência de server-only, para permitir testes isolados.
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
export function buildAuthorizeUrl(state: string): string {
  const params = [
    ["response_type", "code"],
    ["client_id", caConfig.clientId],
    ["redirect_uri", caConfig.redirectUri],
    ["state", state],
    ["scope", caConfig.oauthScope],
  ]
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return `${caConfig.authorizeUrl}${caConfig.authorizeUrl.includes("?") ? "&" : "?"}${params}`;
}
