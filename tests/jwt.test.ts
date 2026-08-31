import { describe, expect, it } from "vitest";

import { signJwt, verifyJwt } from "@/lib/auth/jwt";

const SECRET = "segredo-de-teste-super-secreto";

describe("signJwt/verifyJwt", () => {
  it("faz roundtrip das claims", async () => {
    const token = await signJwt({ sub: "admin" }, SECRET, 3600);
    const claims = await verifyJwt(token, SECRET);

    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe("admin");
    expect(typeof claims?.iat).toBe("number");
    expect(claims!.exp).toBeGreaterThan(claims!.iat!);
    expect(claims!.exp - claims!.iat!).toBe(3600);
  });

  it("rejeita token assinado com outro segredo", async () => {
    const token = await signJwt({ sub: "admin" }, SECRET, 3600);
    await expect(verifyJwt(token, "outro-segredo")).resolves.toBeNull();
  });

  it("rejeita payload adulterado", async () => {
    const token = await signJwt({ sub: "admin" }, SECRET, 3600);
    const [, payload] = token.split(".");
    const adulterado = btoa(JSON.stringify({ sub: "intruso", iat: 1, exp: 9999999999 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(verifyJwt(`eyJhbGciOiJIUzI1NiJ9.${payload}`, SECRET)).resolves.toBeNull();
    await expect(
      verifyJwt(`${token.split(".")[0]}.${adulterado}.${token.split(".")[2]}`, SECRET),
    ).resolves.toBeNull();
  });

  it("rejeita token expirado", async () => {
    const token = await signJwt({ sub: "admin" }, SECRET, -10);
    await expect(verifyJwt(token, SECRET)).resolves.toBeNull();
  });

  it.each(["", "abc", "a.b.c", "x.y.z", "...."])("rejeita token malformado %j", async (token) => {
    await expect(verifyJwt(token, SECRET)).resolves.toBeNull();
  });

  it("produz token com três segmentos base64url", async () => {
    const token = await signJwt({ sub: "admin" }, SECRET, 60);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    // Header HS256 padrão.
    expect(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"))).toContain("HS256");
  });
});
