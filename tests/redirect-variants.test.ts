import { describe, expect, it } from "vitest";

import { redirectUriVariants } from "@/lib/contaazul/redirect-variants";

describe("redirectUriVariants", () => {
  it("gera variação apex a partir de uma URL com www", () => {
    expect(redirectUriVariants("https://www.contaazul.com")).toEqual([
      "https://www.contaazul.com",
      "https://contaazul.com",
    ]);
  });

  it("gera variação com www a partir de uma URL sem www", () => {
    expect(redirectUriVariants("https://contaazul.com")).toEqual([
      "https://contaazul.com",
      "https://www.contaazul.com",
    ]);
  });

  it("preserva caminho e query nas variações", () => {
    expect(redirectUriVariants("http://localhost:3000/api/auth/callback")).toEqual([
      "http://localhost:3000/api/auth/callback",
      "http://www.localhost:3000/api/auth/callback",
    ]);
  });

  it("não duplica quando já contém ambas as formas impossíveis", () => {
    // URL sem host com www não gera colisão; apenas garante sem duplicatas.
    const variants = redirectUriVariants("https://www.exemplo.com/path");
    expect(new Set(variants).size).toBe(variants.length);
  });
});
