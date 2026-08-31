import type { NextRequest } from "next/server";

import { isOAuthConfigured } from "@/lib/config";
import { buildAuthorizeUrl } from "@/lib/contaazul/client";

export const dynamic = "force-dynamic";

/**
 * Inicia o fluxo OAuth2: redireciona o usuário para a tela de autorização
 * da Conta Azul com um `state` anti-CSRF gravado em cookie httpOnly.
 *
 * Usa `Response` puro (e não `NextResponse.redirect`) porque a URL de
 * autorização oficial contém um fragmento (`#/oauth/authorize`) que precisa
 * ser preservado no cabeçalho `Location`.
 */
export async function GET(request: NextRequest) {
  if (!isOAuthConfigured()) {
    return Response.redirect(
      new URL("/?auth=erro&motivo=credenciais-nao-configuradas", request.url),
      307,
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = buildAuthorizeUrl(state);

  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 307,
    headers: {
      Location: authorizeUrl,
      "Set-Cookie": `ca_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag}`,
      "Cache-Control": "no-store",
    },
  });
}
