import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O módulo declara `import "server-only"`, que só resolve corretamente em
 * runtime RSC. Nos testes, substituímos por um stub inofensivo.
 */
vi.mock("server-only", () => ({}));

/**
 * `auth-store` resolve o caminho do cache a partir de `process.cwd()` no
 * momento do import. Cada teste roda em um diretório temporário e importa o
 * módulo dinamicamente para isolar completamente o estado (arquivo e memória).
 */

const originalCwd = process.cwd();
let tmpDir = "";

async function loadStore() {
  vi.resetModules();
  return import("@/lib/contaazul/auth-store");
}

function permissionBits(target: string): number {
  return fsSync.statSync(target).mode & 0o777;
}

describe("auth-store", () => {
  beforeEach(() => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "ca-auth-store-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fsSync.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("persiste os tokens em .cache/ca-tokens.json", async () => {
    const { setTokens } = await loadStore();

    await setTokens({ accessToken: "token-de-teste" });

    const raw = fsSync.readFileSync(path.join(".cache", "ca-tokens.json"), "utf8");
    expect(JSON.parse(raw)).toMatchObject({ accessToken: "token-de-teste" });
  });

  it("cria diretório e arquivo com permissões restritivas", async () => {
    const { setTokens } = await loadStore();

    await setTokens({ accessToken: "abc" });

    expect(permissionBits(".cache")).toBe(0o700);
    expect(permissionBits(path.join(".cache", "ca-tokens.json"))).toBe(0o600);
  });

  it("corrige permissões de arquivo pré-existente com permissões abertas", async () => {
    // Simula um ca-tokens.json criado por versão anterior/cópia/restauração.
    fsSync.mkdirSync(".cache");
    fsSync.writeFileSync(path.join(".cache", "ca-tokens.json"), "{}");
    fsSync.chmodSync(path.join(".cache", "ca-tokens.json"), 0o644);

    const { setTokens } = await loadStore();
    await setTokens({ accessToken: "novo-token" });

    expect(permissionBits(path.join(".cache", "ca-tokens.json"))).toBe(0o600);
  });

  it("corrige permissões de diretório pré-existente com permissões abertas", async () => {
    fsSync.mkdirSync(".cache", { mode: 0o755 });
    fsSync.chmodSync(".cache", 0o755);

    const { setTokens } = await loadStore();
    await setTokens({ accessToken: "novo-token" });

    expect(permissionBits(".cache")).toBe(0o700);
  });

  it("clearTokens remove memória, disco e invalida isConnected", async () => {
    const { setTokens, clearTokens, isConnected } = await loadStore();
    await setTokens({ accessToken: "abc" });

    await clearTokens();

    expect(fsSync.existsSync(path.join(".cache", "ca-tokens.json"))).toBe(false);
    expect(await isConnected()).toBe(false);
  });

  it("isConnected reflete tokens persistidos de sessões anteriores", async () => {
    const primeiraInstancia = await loadStore();
    await primeiraInstancia.setTokens({ accessToken: "sobreviveu" });

    // Nova instância do módulo = novo processo/servidor reiniciado.
    const segundaInstancia = await loadStore();
    expect(await segundaInstancia.isConnected()).toBe(true);
  });
});
