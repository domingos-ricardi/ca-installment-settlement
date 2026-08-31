import { caConfig } from "@/lib/config";
import { signJwt, verifyJwt } from "@/lib/auth/jwt";

/**
 * Sessão de usuário único: credenciais vindas do `.env`, JWT assinado
 * gravado em cookie httpOnly. Sem banco de dados.
 */

export const SESSION_COOKIE_NAME = "ca_session";

/** Duração da sessão em segundos (configurável em horas via ambiente). */
function sessionTtlSeconds(): number {
  const hours = Number.isFinite(caConfig.authSessionTtlHours)
    ? caConfig.authSessionTtlHours
    : 12;
  return Math.max(1, Math.trunc(hours * 3600));
}

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Compara as credenciais informadas com as esperadas (do ambiente).
 * Hash SHA-256 + comparação em tempo constante evitam vazamento por timing.
 */
export async function checkCredentials(
  provided: { username: string; password: string },
  expected: { username: string; password: string },
): Promise<boolean> {
  // Credenciais não configuradas nunca autenticam — nem com campos vazios.
  if (expected.username.length === 0 || expected.password.length === 0) {
    return false;
  }
  const [providedUser, expectedUser] = await Promise.all([
    sha256Bytes(provided.username),
    sha256Bytes(expected.username),
  ]);
  const [providedPassword, expectedPassword] = await Promise.all([
    sha256Bytes(provided.password),
    sha256Bytes(expected.password),
  ]);
  return (
    constantTimeEquals(providedUser, expectedUser) &&
    constantTimeEquals(providedPassword, expectedPassword)
  );
}

/** Emite o token de sessão para o usuário autenticado. */
export function createSessionToken(username: string): Promise<string> {
  return signJwt({ sub: username }, caConfig.authJwtSecret, sessionTtlSeconds());
}

/** Valida o token do cookie; retorna o nome do usuário ou `null`. */
export function verifySessionToken(token: string): Promise<{ sub: string } | null> {
  return verifyJwt(token, caConfig.authJwtSecret);
}

/** Atributos do cookie de sessão (httpOnly, SameSite=Lax, Secure em produção). */
export function sessionCookieAttributes(maxAgeSeconds: number): string {
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}
