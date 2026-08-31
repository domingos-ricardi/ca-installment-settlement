import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Testes do caminho Vercel KV / Upstash Redis do auth-store.
 *
 * Garante que, quando KV_REST_API_URL e KV_REST_API_TOKEN estão definidos
 * (produção no Vercel), os tokens são lidos/gravados/removidos via API REST
 * do Upstash — o único storage que persiste entre instâncias serverless.
 */

// Mocks global fetch ANTES de importar o módulo (que define as constantes de
// env no load). Como o auth-store lê env no import, usamos import dinâmico
// após configurar as variáveis.
const fetchMock = vi.fn();

const originalEnv = {
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  CA_TOKENS_KV_TTL_SECONDS: process.env.CA_TOKENS_KV_TTL_SECONDS,
};

async function loadKvStore() {
  vi.resetModules();
  return import("@/lib/contaazul/auth-store");
}

describe("auth-store com Vercel KV configurado", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = "https://us1-exemplo.upstash.io";
    process.env.KV_REST_API_TOKEN = "teste-token-kv";
    process.env.CA_TOKENS_KV_TTL_SECONDS = "3600";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
      status: 200,
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    process.env.KV_REST_API_URL = originalEnv.KV_REST_API_URL;
    process.env.KV_REST_API_TOKEN = originalEnv.KV_REST_API_TOKEN;
    process.env.CA_TOKENS_KV_TTL_SECONDS = originalEnv.CA_TOKENS_KV_TTL_SECONDS;
  });

  it("usa o KV (não memória/arquivo) para GET", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: JSON.stringify({ accessToken: "token-kv" }),
      }),
      status: 200,
    });

    const { getTokens } = await loadKvStore();
    const tokens = await getTokens();

    expect(tokens).toEqual({ accessToken: "token-kv" });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/get/ca_tokens");
  });

  it("envia Authorization Bearer com KV_REST_API_TOKEN", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
      status: 200,
    });

    const { getTokens } = await loadKvStore();
    await getTokens();

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)?.Authorization).toBe(
      "Bearer teste-token-kv",
    );
  });

  it("grava via SETEX com TTL quando há expiração", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: "OK" }),
      status: 200,
    });

    const { setTokens } = await loadKvStore();
    await setTokens({ accessToken: "abc", refreshToken: "refresh" });

    const [url] = fetchMock.mock.calls[0];
    const text = String(url);
    expect(text).toContain("/setex/ca_tokens/3600/");
    expect(text).toContain(encodeURIComponent('"refreshToken":"refresh"'));
  });

  it("remove via DEL em clearTokens", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 1 }),
      status: 200,
    });

    const { clearTokens } = await loadKvStore();
    await clearTokens();

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/del/ca_tokens");
  });

  it("propaga token expirado/ausente como null (sem lançar)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
      status: 200,
    });

    const { isConnected } = await loadKvStore();
    expect(await isConnected()).toBe(false);
  });
});
