import { NextResponse } from "next/server";

import { caConfig, isOAuthConfigured } from "@/lib/config";
import { getTokens } from "@/lib/contaazul/auth-store";
import { buildAuthorizeUrl } from "@/lib/contaazul/authorize-url";

export const dynamic = "force-dynamic";

/**
 * Endpoint de diagnóstico (produção/depuração).
 *
 * Devolve dados de configuração e a URL de autorização efetivamente montada,
 * para conferir se a `redirect_uri` enviada ao Conta Azul bate EXATAMENTE
 * com a cadastrada no Portal do Desenvolvedor (o OAuth2 exige igualdade exata).
 *
 * Nenhum segredo (client_secret, tokens) é exposto — apenas a URL de
 * autorização, que já seria visível ao usuário no navegador.
 */
export async function GET() {
  const tokens = await getTokens();
  const authorizeUrl = isOAuthConfigured()
    ? buildAuthorizeUrl("diagnostico")
    : null;

  return NextResponse.json({
    producao: process.env.NODE_ENV === "production",
    oauthConfigured: isOAuthConfigured(),
    clientIdPrefixo: isOAuthConfigured()
      ? `${caConfig.clientId.slice(0, 6)}…${caConfig.clientId.slice(-4)}`
      : null,
    redirectUri: caConfig.redirectUri,
    authorizeUrl,
    connected: Boolean(tokens?.accessToken),
    dica:
      "A redirect_uri exibida acima deve ser EXATAMENTE igual à cadastrada " +
      "no Portal do Desenvolvedor, incluindo http/https e www (sem barras extras).",
  });
}
