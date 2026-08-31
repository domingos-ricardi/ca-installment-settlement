import { beforeEach, describe, expect, it } from "vitest";

import { caConfig } from "@/lib/config";
import { buildAuthorizeUrl } from "@/lib/contaazul/authorize-url";

/**
 * Testes do `buildAuthorizeUrl` (Etapa 1 do OAuth2).
 *
 * Garante que a URL de autorização seja montada com os parâmetros DENTRO do
 * fragmento `#/oauth/authorize`, com valores BRUTOS (sem percent-encoding).
 * Percent-encoding no `redirect_uri` (ex. `://` → `%3A%2F%2F`) faz o Conta Azul
 * rejeitar com `invalid_request` porque a comparação com a URL registrada é exata.
 */

const REDIRECT_URI = "https://www.meusite.com.br/api/auth/callback";

describe("buildAuthorizeUrl", () => {
  beforeEach(() => {
    // `caConfig` é um singleton avaliado no load do módulo; mutamos suas
    // propriedades diretamente (via cast, pois `as const` as marca readonly
    // em nível de tipo, mas em runtime o objeto é mutável) para controlar a
    // saída da função sem depender de env vars.
    const config = caConfig as {
      clientId: string;
      redirectUri: string;
      oauthScope: string;
      authorizeUrl: string;
    };
    config.clientId = "teste-client-id";
    config.redirectUri = REDIRECT_URI;
    config.oauthScope = "openid profile aws.cognito.signin.user.admin";
    config.authorizeUrl = "https://login.contaazul.com/#/oauth/authorize";
  });

  it("anexa os parâmetros ao fragmento (#/oauth/authorize) após o #", () => {
    const url = buildAuthorizeUrl("estado-abc");
    expect(url).toContain("https://login.contaazul.com/#/oauth/authorize?");
    // Parâmetros vêm DEPOIS do #, não antes.
    expect(url.indexOf("#")).toBeLessThan(url.indexOf("response_type=code"));
  });

  it("NÃO faz percent-encoding do redirect_uri (valores brutos)", () => {
    const url = buildAuthorizeUrl("estado-abc");
    expect(url).toContain(`redirect_uri=${REDIRECT_URI}`);
    expect(url).not.toContain("redirect_uri=https%3A%2F%2F");
    expect(url).not.toContain("%3A%2F%2F");
  });

  it("inclui response_type=code, client_id e state", () => {
    const url = buildAuthorizeUrl("estado-abc");
    expect(url).toContain("response_type=code");
    expect(url).toContain("client_id=teste-client-id");
    expect(url).toContain("state=estado-abc");
  });

  it("inclui o scope (espaços preservados)", () => {
    const url = buildAuthorizeUrl("estado-abc");
    expect(url).toContain("scope=openid profile aws.cognito.signin.user.admin");
  });

  it("mantém o fragmento no formato oficial da documentação", () => {
    const url = buildAuthorizeUrl("123e4567-e89b-12d3-a456-426614174000");
    expect(url).toBe(
      "https://login.contaazul.com/#/oauth/authorize?" +
        "response_type=code" +
        "&client_id=teste-client-id" +
        `&redirect_uri=${REDIRECT_URI}` +
        "&state=123e4567-e89b-12d3-a456-426614174000" +
        "&scope=openid profile aws.cognito.signin.user.admin",
    );
  });

  it("trata authorizeUrl com '?' já presente (usa '&')", () => {
    (caConfig as { authorizeUrl: string }).authorizeUrl =
      "https://login.contaazul.com/#/oauth/authorize?x=1";
    const url = buildAuthorizeUrl("estado-abc");
    expect(url).toContain("/oauth/authorize?x=1&response_type=code");
  });
});
