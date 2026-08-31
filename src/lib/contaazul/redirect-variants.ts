/**
 * Variações de `redirect_uri` para a troca manual do código de autorização
 * (fluxo de app de Desenvolvimento da Conta Azul).
 *
 * O OAuth2 exige que a `redirect_uri` enviada na troca seja idêntica à usada
 * na autorização. Como o fluxo de dev pode registrar internamente a URL com
 * ou sem `www`, tentamos ambas as formas.
 */

/** Gera candidatos de redirect_uri: a original primeiro, depois variações www/apex. */
export function redirectUriVariants(primary: string): string[] {
  const result = new Set<string>([primary]);

  if (primary.includes("://www.")) {
    result.add(primary.replace("://www.", "://"));
  } else {
    result.add(primary.replace("://", "://www."));
  }

  return [...result];
}
