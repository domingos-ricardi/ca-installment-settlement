import { NextResponse } from "next/server";

import { clearTokens } from "@/lib/contaazul/auth-store";

export const dynamic = "force-dynamic";

/** Encerra a sessão local removendo os tokens armazenados. */
export async function POST() {
  await clearTokens();
  return NextResponse.json({ connected: false });
}
