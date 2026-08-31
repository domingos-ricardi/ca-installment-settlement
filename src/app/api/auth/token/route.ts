import { NextResponse } from "next/server";

import { z } from "zod";

import { setTokens } from "@/lib/contaazul/auth-store";

export const dynamic = "force-dynamic";

/**
 * Fallback para desenvolvimento: permite informar manualmente um access token
 * (e opcionalmente o refresh token) obtido no Portal do Desenvolvedor,
 * quando não é possível configurar a URL de redirecionamento do OAuth2.
 */
const bodySchema = z.object({
  access_token: z.string().min(10, "access_token inválido"),
  refresh_token: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
});

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
      { error: "Payload inválido.", detalhes: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await setTokens({
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt: parsed.data.expires_in
      ? Date.now() + parsed.data.expires_in * 1000
      : undefined,
  });

  return NextResponse.json({ connected: true });
}
