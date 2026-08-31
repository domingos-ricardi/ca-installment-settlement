/**
 * Configuração central da aplicação.
 * Todos os valores possuem defaults seguros; segredos vêm de variáveis de ambiente.
 */

function env(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const caConfig = {
  /** Credenciais do usuário único da aplicação (login local). */
  authUsername: env("AUTH_USERNAME", ""),
  authPassword: env("AUTH_PASSWORD", ""),
  /** Segredo HMAC para assinar o JWT do cookie de sessão. */
  authJwtSecret: env("AUTH_JWT_SECRET", ""),
  /** Duração da sessão em horas. */
  authSessionTtlHours: Number(env("AUTH_SESSION_TTL_HOURS", "12")),

  clientId: env("CA_CLIENT_ID", ""),
  clientSecret: env("CA_CLIENT_SECRET", ""),

  redirectUri: env("CA_REDIRECT_URI", "http://localhost:3000/api/auth/callback"),

  oauthScope: env("CA_OAUTH_SCOPE", "openid profile aws.cognito.signin.user.admin"),
  authorizeUrl: env("CA_AUTHORIZE_URL", "https://login.contaazul.com/#/oauth/authorize"),
  // Documentação oficial (Etapa 2 - Trocando o código pelo token):
  // https://developers.contaazul.com/changecode
  tokenUrl: env("CA_TOKEN_URL", "https://api-v2.contaazul.com/oauth/token"),

  apiBaseUrl: env("CA_API_BASE_URL", "https://api-v2.contaazul.com"),

  /** Delay entre requisições de baixa no processamento em lote (rate limit). */
  baixasRequestDelayMs: Number(env("BAIXAS_REQUEST_DELAY_MS", "300")),

  contasFinanceirasPageSize: Number(env("CONTAS_FINANCEIRAS_PAGE_SIZE", "100")),

  /** Tamanho de página ao buscar lançamentos/eventos financeiros (dropdown). */
  eventosFinanceirosPageSize: Number(env("EVENTOS_FINANCEIROS_PAGE_SIZE", "200")),
} as const;

/** Indica se o fluxo OAuth2 completo está configurado (client credentials presentes). */
export function isOAuthConfigured(): boolean {
  return caConfig.clientId.length > 0 && caConfig.clientSecret.length > 0;
}

/** Indica se o login local está configurado (usuário, senha e segredo JWT presentes). */
export function isAuthConfigured(): boolean {
  return (
    caConfig.authUsername.length > 0 &&
    caConfig.authPassword.length > 0 &&
    caConfig.authJwtSecret.length > 0
  );
}
