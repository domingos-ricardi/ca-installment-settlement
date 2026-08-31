import { z } from "zod";

import { NextResponse } from "next/server";

import { isAuthConfigured } from "@/lib/config";
import {
  SESSION_COOKIE_NAME,
  checkCredentials,
  createSessionToken,
  sessionCookieAttributes,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Login local de usuário único: valida contra AUTH_USERNAME/AUTH_PASSWORD do
 * ambiente e grava um JWT assinado em cookie httpOnly.
 */

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Autenticação não configurada: defina AUTH_USERNAME, AUTH_PASSWORD e AUTH_JWT_SECRET no .env.local.",
      },
      { status: 500 },
    );
  }

  let json: unknown;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    json = await request.json().catch(() => null);
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    // Fallback sem JavaScript: envia via POST de formulário (as credenciais
    // nunca aparecem na URL). O handler do componente usa JSON por padrão.
    const form = await request.formData();
    json = { username: form.get("username"), password: form.get("password") };
  } else {
    return NextResponse.json(
      { error: "Content-Type não suportado (use JSON ou form-urlencoded)." },
      { status: 415 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe usuário e senha." }, { status: 400 });
  }

  const valid = await checkCredentials(parsed.data, {
    username: process.env.AUTH_USERNAME ?? "",
    password: process.env.AUTH_PASSWORD ?? "",
  });
  if (!valid) {
    // Mensagem genérica: não revela se falhou usuário ou senha.
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const token = await createSessionToken(parsed.data.username);
  const ttl = Number(process.env.AUTH_SESSION_TTL_HOURS ?? "12") * 3600;

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // TTL do cookie acompanha a sessão; revalidação do JWT continua sendo feita.
      "Set-Cookie": `${SESSION_COOKIE_NAME}=${token}; ${sessionCookieAttributes(ttl)}`,
      "Cache-Control": "no-store",
    },
  });
}
