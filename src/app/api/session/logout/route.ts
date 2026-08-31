import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Encerra a sessão: remove o cookie httpOnly e volta para /login.
 * Aceita POST via formulário nativo do header (sem JS).
 */
export async function POST() {
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`,
      "Cache-Control": "no-store",
    },
  });
}
