"use client";

import { useEffect, useState } from "react";

interface AuthStatus {
  connected: boolean;
  oauthConfigured: boolean;
  expiresAt: number | null;
  redirectUri?: string | null;
}

interface ConnectionBannerProps {
  onStatusChange?: (status: AuthStatus) => void;
}

/** Banner de conexão com a Conta Azul: status, login OAuth2 e token manual. */
export function ConnectionBanner({ onStatusChange }: ConnectionBannerProps) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [showManualToken, setShowManualToken] = useState(false);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualRefresh, setManualRefresh] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      const response = await fetch("/api/auth/status");
      const data = (await response.json()) as AuthStatus;
      setStatus(data);
      onStatusChange?.(data);
    } catch {
      setStatus({ connected: false, oauthConfigured: false, expiresAt: null });
    }
  }

  // Verifica o status ao montar (setState ocorre apenas após o await).
  useEffect(() => {
    let ignore = false;
    async function startChecking() {
      const response = await fetch("/api/auth/status");
      const data = (await response.json()) as AuthStatus;
      if (ignore) return;
      setStatus(data);
      onStatusChange?.(data);
    }
    void startChecking().catch(() => {
      if (!ignore) {
        setStatus({ connected: false, oauthConfigured: false, expiresAt: null });
      }
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshStatus();
  }

  async function handleManualToken(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const response = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: manualToken.trim(),
        ...(manualRefresh.trim() ? { refresh_token: manualRefresh.trim() } : {}),
      }),
    });

    if (response.ok) {
      setManualToken("");
      setManualRefresh("");
      setShowManualToken(false);
      setFeedback("Token salvo com sucesso.");
      await refreshStatus();
    } else {
      const data = (await response.json()) as { error?: string };
      setFeedback(data.error ?? "Não foi possível salvar o token.");
    }
  }

  /** Fluxo para apps de Desenvolvimento: troca o código colado pelo usuário. */
  async function handleAuthCode(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    const response = await fetch("/api/auth/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: authCode }),
    });

    if (response.ok) {
      setAuthCode("");
      setShowAuthCode(false);
      setFeedback("Conectado com sucesso!");
      await refreshStatus();
    } else {
      const data = (await response.json()) as {
        error?: string;
        detalhes?: unknown;
        dica?: string;
      };
      const detalhes =
        data.detalhes && typeof data.detalhes === "object"
          ? JSON.stringify(data.detalhes)
          : String(data.detalhes ?? "");
      setFeedback(
        [
          data.error ?? "Não foi possível trocar o código por token.",
          detalhes ? `(${detalhes})` : "",
          data.dica ?? "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              status?.connected ? "bg-emerald-500" : "bg-red-400"
            }`}
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-slate-800">
              {status === null
                ? "Verificando conexão…"
                : status.connected
                  ? "Conectado à Conta Azul"
                  : "Desconectado da Conta Azul"}
            </p>
            {status?.connected && status.expiresAt && (
              <p className="text-xs text-slate-500">
                Token expira em{" "}
                {new Date(status.expiresAt).toLocaleTimeString("pt-BR")}
              </p>
            )}
            {status && !status.oauthConfigured && (
              <p className="text-xs text-amber-600">
                CA_CLIENT_ID/CA_CLIENT_SECRET não configurados no .env.local —
                use a conexão por token manual.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status?.connected ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Desconectar
            </button>
          ) : (
            <>
              <a
                href="/api/auth/login"
                aria-disabled={!status?.oauthConfigured}
                title={
                  status?.oauthConfigured
                    ? undefined
                    : "Desabilitado: preencha CA_CLIENT_ID e CA_CLIENT_SECRET no .env.local e reinicie o servidor."
                }
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${
                  status?.oauthConfigured
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "cursor-not-allowed bg-slate-300"
                }`}
              >
                Conectar com Conta Azul
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowManualToken((v) => !v);
                  setShowAuthCode(false);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Token manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAuthCode((v) => !v);
                  setShowManualToken(false);
                }}
                title="Para apps de Desenvolvimento: autorize no Conta Azul e cole aqui o código retornado na URL final"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Código de autorização
              </button>
            </>
          )}
        </div>
      </div>

      {showAuthCode && (
        <form onSubmit={handleAuthCode} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Fluxo para apps de <strong>Desenvolvimento</strong>: clique em
            &quot;Conectar com Conta Azul&quot;, autorize e você será levado a uma
            página do Conta Azul com <code className="rounded bg-slate-100 px-1">?code=…</code>{" "}
            na URL. Copie o código (ou a URL inteira) e cole abaixo.
          </p>
          <input
            type="text"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            placeholder="Cole aqui o código ou a URL completa de retorno"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Conectar
            </button>
            {feedback && <span className="text-xs text-slate-600">{feedback}</span>}
          </div>
        </form>
      )}

      {showManualToken && (
        <form onSubmit={handleManualToken} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Fallback para desenvolvimento: informe um access token gerado no
            Portal do Desenvolvedor da Conta Azul.
          </p>
          <input
            type="password"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="access_token"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            value={manualRefresh}
            onChange={(e) => setManualRefresh(e.target.value)}
            placeholder="refresh_token (opcional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Salvar token
            </button>
            {feedback && <span className="text-xs text-slate-600">{feedback}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
