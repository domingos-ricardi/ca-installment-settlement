/**
 * JWT HS256 mínimo (assinatura + verificação) construído sobre a Web Crypto
 * API — funciona no runtime Node.js do proxy/route handlers e não exige
 * dependências externas.
 *
 * Formato padrão: base64url(header).base64url(payload).base64url(hmac-sha256)
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface JwtClaims {
  /** Assunto (nome do usuário autenticado). */
  sub: string;
  /** Emitido em (unix seconds). */
  iat?: number;
  /** Expira em (unix seconds). */
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(segment: string): Uint8Array | null {
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacSha256(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

/** Comparação em tempo constante entre duas sequências de bytes. */
function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Emite um JWT HS256 assinado com o segredo informado. */
export async function signJwt(
  claims: { sub: string },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = { ...claims, iat, exp: iat + ttlSeconds };
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(
    encoder.encode(JSON.stringify(payload)),
  )}`;
  const signature = await hmacSha256(signingInput, secret);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verifica assinatura (tempo constante), formato e validade do token.
 * Retorna as claims quando válido ou `null` para qualquer problema —
 * nunca lança exceção.
 */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const expectedSignature = await hmacSha256(`${headerSegment}.${payloadSegment}`, secret);
  const providedSignature = base64UrlDecode(signatureSegment ?? "");
  if (!providedSignature || !constantTimeEquals(expectedSignature, providedSignature)) {
    return null;
  }

  const payloadBytes = base64UrlDecode(payloadSegment ?? "");
  if (!payloadBytes) return null;
  try {
    const claims = JSON.parse(decoder.decode(payloadBytes)) as Partial<JwtClaims>;
    if (
      typeof claims.exp !== "number" ||
      typeof claims.sub !== "string" ||
      claims.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims as JwtClaims;
  } catch {
    return null;
  }
}
