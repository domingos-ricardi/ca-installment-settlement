import { NextResponse, type NextRequest } from "next/server";

import { caConfig } from "@/lib/config";
import { exchangeCodeForTokens } from "@/lib/contaazul/client";
import { setTokens } from "@/lib/contaazul/auth-store";

export const dynamic = "force-dynamic";

/**
 * Callback do fluxo OAuth2: valida o `state`, troca o código de autorização
 * por tokens e redireciona de volta para a tela principal.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/?auth=erro&motivo=${encodeURIComponent(oauthError)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?auth=erro&motivo=codigo-ausente", request.url),
    );
  }

  const expectedState = request.cookies.get("ca_oauth_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/?auth=erro&motivo=state-invalido", request.url),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, caConfig.redirectUri);
    await setTokens(tokens);

    const response = NextResponse.redirect(new URL("/?auth=sucesso", request.url));
    response.cookies.delete("ca_oauth_state");
    return response;
  } catch (error) {
    const motivo = error instanceof Error ? error.message : "falha-troca-token";
    return NextResponse.redirect(
      new URL(`/?auth=erro&motivo=${encodeURIComponent(motivo)}`, request.url),
    );
  }
}
