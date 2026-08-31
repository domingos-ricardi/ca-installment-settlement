import { describe, expect, it } from "vitest";

import {
  formatCurrencyBrl,
  formatIsoDateBr,
  isoDaysFromToday,
} from "@/lib/format";

describe("formatIsoDateBr", () => {
  it("formata datas ISO", () => {
    expect(formatIsoDateBr("2026-08-15")).toBe("15/08/2026");
  });

  it("recorta timestamp quando presente", () => {
    expect(formatIsoDateBr("2026-08-15T10:00:00")).toBe("15/08/2026");
  });

  it("retorna traço para valores inválidos", () => {
    expect(formatIsoDateBr(null)).toBe("—");
    expect(formatIsoDateBr("15/08/2026")).toBe("—");
  });
});

describe("formatCurrencyBrl", () => {
  it("formata valores numéricos em BRL", () => {
    expect(formatCurrencyBrl(1234.5)).toContain("1.234,50");
  });

  it("retorna traço para não numéricos", () => {
    expect(formatCurrencyBrl(null)).toBe("—");
    expect(formatCurrencyBrl(undefined)).toBe("—");
    expect(formatCurrencyBrl(Number.NaN)).toBe("—");
  });
});

describe("isoDaysFromToday", () => {
  function isoLocal(date: Date): string {
    const y = String(date.getFullYear()).padStart(4, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  it("retorna hoje com delta zero no formato ISO", () => {
    expect(isoDaysFromToday(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isoDaysFromToday(0)).toBe(isoLocal(new Date()));
  });

  it("avança e retrocede dias corretamente", () => {
    const base = new Date();
    const amanha = new Date(base);
    amanha.setDate(base.getDate() + 1);
    const ontem = new Date(base);
    ontem.setDate(base.getDate() - 1);
    expect(isoDaysFromToday(1)).toBe(isoLocal(amanha));
    expect(isoDaysFromToday(-1)).toBe(isoLocal(ontem));
  });
});
