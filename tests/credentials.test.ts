import { describe, expect, it } from "vitest";

import { checkCredentials } from "@/lib/auth/session";

const EXPECTED = { username: "admin", password: "s3nh4-f0rte!" };

describe("checkCredentials", () => {
  it("aceita credenciais corretas", async () => {
    await expect(
      checkCredentials({ username: "admin", password: "s3nh4-f0rte!" }, EXPECTED),
    ).resolves.toBe(true);
  });

  it.each([
    ["usuário errado", { username: "root", password: "s3nh4-f0rte!" }],
    ["senha errada", { username: "admin", password: "errada" }],
    ["ambas erradas", { username: "x", password: "y" }],
    ["campos vazios", { username: "", password: "" }],
  ])("rejeita %s", async (_nome, provided) => {
    await expect(checkCredentials(provided, EXPECTED)).resolves.toBe(false);
  });

  it("é sensível a caixa no usuário e na senha", async () => {
    await expect(
      checkCredentials({ username: "Admin", password: "s3nh4-f0rte!" }, EXPECTED),
    ).resolves.toBe(false);
    await expect(
      checkCredentials({ username: "admin", password: "S3NH4-F0RTE!" }, EXPECTED),
    ).resolves.toBe(false);
  });

  it("rejeita quando esperado está vazio (auth não configurado)", async () => {
    const vazio = { username: "", password: "" };
    await expect(checkCredentials(vazio, vazio)).resolves.toBe(false);
  });
});
