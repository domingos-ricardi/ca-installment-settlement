import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

/**
 * Gate de autenticação da aplicação (padrão `proxy` do Next 16, sucessor do
 * middleware). Exige um JWT válido no cookie de sessão para qualquer rota
 * que não seja pública.
 *
 * Públicos: /login (tela) e /api/session/login (autenticação).
 * Estáticos (_next/*, favicon) passam sem verificação para não bloquear o
 * CSS/JS da própria tela de login.
 *
 * Rotas de API recebem 401 JSON; páginas são redirecionadas para /login.
 */

const PUBLIC_PATHS = new Set(["/login", "/api/session/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/next/static") ||
    pathname === "/favicon.ico" ||
    PUBLIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Executa em todas as rotas exceto estáticos; exceções finas tratadas acima.
  // `next/static` (sem underscore) é o caminho usado pelo Turbopack no dev.
  matcher: [
    "/((?!_next/static|_next/image|_next/hmr|next/static|favicon.ico).*)",
  ],
};
