import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { z } from "zod";

import { caConfig } from "@/lib/config";
import { CaApiError, exchangeCodeForTokens } from "@/lib/contaazul/client";
import { setTokens, type CaTokens } from "@/lib/contaazul/auth-store";
import { redirectUriVariants } from "@/lib/contaazul/redirect-variants";

export const dynamic = "force-dynamic";

/**
 * Troca manual do código de autorização por tokens (fluxo de app de
 * DESENVOLVIMENTO da Conta Azul).
 *
 * O código de autorização é de uso único e curto; a `redirect_uri` da troca
 * precisa ser idêntica à usada na autorização — mas o fluxo de dev pode ter
 * registrado internamente a URL com ou sem `www`, ou não exigir o parâmetro.
 * Por isso tentamos as variações em sequência e memorizamos a que funcionar.
 */

const bodySchema = z.object({
  code: z.string().min(5, "Informe o código de autorização."),
});

const DEV_REDIRECT_CACHE = path.join(process.cwd(), ".cache", "ca-dev-redirect.txt");

/** Aceita tanto o código puro quanto a URL completa de redirecionamento. */
function extractCode(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code) return code;
  } catch {
    // Não é uma URL — considera que o texto já é o código.
  }
  return trimmed;
}

async function readPreferredRedirect(): Promise<string | null> {
  try {
    const raw = await fs.readFile(DEV_REDIRECT_CACHE, "utf8");
    return raw.trim();
  } catch {
    return null;
  }
}

async function savePreferredRedirect(value: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(DEV_REDIRECT_CACHE), { recursive: true });
    await fs.writeFile(DEV_REDIRECT_CACHE, value, "utf8");
  } catch {
    // Best-effort: sem cache, apenas repetimos as tentativas na próxima vez.
  }
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.code?.[0] ?? "Payload inválido." },
      { status: 400 },
    );
  }

  const code = extractCode(parsed.data.code);

  // Ordena candidatos: estratégia que funcionou antes primeiro.
  const preferred = await readPreferredRedirect();
  let candidates = redirectUriVariants(caConfig.redirectUri);
  if (preferred !== null) {
    candidates =
      preferred === ""
        ? [...candidates] // "" = última tentativa sem redirect_uri; mantém ordem padrão
        : [preferred, ...candidates.filter((c) => c !== preferred)];
  }

  let lastError: CaApiError | null = null;

  for (const candidate of candidates) {
    const result = await attemptExchange(code, candidate);
    if (result.tokens) {
      await setTokens(result.tokens);
      await savePreferredRedirect(candidate);
      console.log(`[auth/exchange] Código trocado com sucesso. redirect_uri aceita: "${candidate}"`);
      return NextResponse.json({ connected: true, redirect_uri_aceita: candidate });
    }
    lastError = result.error ?? lastError;
  }

  // Última tentativa: sem o parâmetro redirect_uri.
  try {
    const tokens = await exchangeCodeForTokens(code);
    await setTokens(tokens);
    await savePreferredRedirect("");
    console.log("[auth/exchange] Código trocado com sucesso. Sem redirect_uri na troca.");
    return NextResponse.json({ connected: true, redirect_uri_aceita: "(não enviada)" });
  } catch (error) {
    if (error instanceof CaApiError) lastError = error;
  }

  console.error("[auth/exchange] Todas as tentativas falharam:", {
    candidates,
    erro_final: lastError?.body ?? lastError?.message,
  });

  return NextResponse.json(
    {
      error:
        lastError?.message ??
        "Não foi possível trocar o código por token na Conta Azul.",
      detalhes: lastError?.body,
      dica: 'Conforme a Conta Azul, o código expira em 3 minutos e é de uso único, e a redirect_uri deve ser exatamente a mesma enviada na autorização. Clique novamente em "Conectar com Conta Azul", autorize e cole o código novo imediatamente.',
    },
    { status: 502 },
  );
}

/** Executa uma tentativa; retorna tokens ou o erro para acumular diagnóstico. */
async function attemptExchange(
  code: string,
  redirectUri: string,
): Promise<{ tokens: CaTokens; error?: undefined } | { tokens?: undefined; error: CaApiError }> {
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    return { tokens };
  } catch (error) {
    if (error instanceof CaApiError) {
      console.error(
        `[auth/exchange] Falhou com redirect_uri="${redirectUri}":`,
        error.status,
        error.body,
      );
      return { error };
    }
    throw error;
  }
}
