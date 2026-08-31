import { NextResponse } from "next/server";

import { caConfig, isOAuthConfigured } from "@/lib/config";
import { getTokens } from "@/lib/contaazul/auth-store";

export const dynamic = "force-dynamic";

/** Status da conexão com a Conta Azul (usado pelo banner da tela). */
export async function GET() {
  const tokens = await getTokens();
  return NextResponse.json({
    connected: Boolean(tokens?.accessToken),
    oauthConfigured: isOAuthConfigured(),
    expiresAt: tokens?.expiresAt ?? null,
    /** Exposto para diagnóstico de mismatch de redirect_uri (não é segredo). */
    redirectUri: caConfig.redirectUri,
  });
}
