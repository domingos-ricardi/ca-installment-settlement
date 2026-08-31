/**
 * Conversores de valores textuais (CSV) para os formatos exigidos pela API
 * do Conta Azul. Funções puras — fáceis de testar e reutilizar.
 */

/**
 * Datas ISO ou BR podem vir acompanhadas de hora ("15/08/2026 14:30",
 * "2024-12-25T10:30:00Z"). O grupo final consome qualquer sufixo iniciado
 * por `T`, espaço em branco ou vírgula — a API do Conta Azul usa apenas a
 * parte da data.
 */
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s,].*)?$/;
const BR_DATE_REGEX = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[T\s,].*)?$/;

/**
 * Converte datas em formato brasileiro (DD/MM/AAAA) ou ISO (AAAA-MM-DD)
 * para o formato ISO exigido pela API (`AAAA-MM-DD`).
 * Qualquer hora anexada ("DD/MM/AAAA HH:mm", "AAAA-MM-DDTHH:mm:ss") é
 * descartada automaticamente. Retorna `null` quando a data é inválida.
 */
export function parseBrazilianDate(input: string): string | null {
  const value = input.trim();
  if (value.length === 0) return null;

  const isoMatch = ISO_DATE_REGEX.exec(value);
  if (isoMatch) {
    return isValidDate(isoMatch[1], isoMatch[2], isoMatch[3])
      ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
      : null;
  }

  const brMatch = BR_DATE_REGEX.exec(value);
  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    const year = brMatch[3];
    return isValidDate(year, month, day) ? `${year}-${month}-${day}` : null;
  }

  return null;
}

function isValidDate(year: string, month: string, day: string): boolean {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  );
}

/**
 * Converte valores monetários textuais para número.
 *
 * Heurística para separadores:
 * - Presença de `.` **e** `,`: o último separador encontrado é o decimal.
 * - Apenas `,`: vírgula é decimal.
 * - Apenas `.`: se seguir o padrão de grupos de três (`1.234` / `12.345.678`),
 *   é separador de milhar; caso contrário, decimal.
 */
export function parseCurrency(input: string): number | null {
  let value = input.trim().replace(/\s/g, "");
  if (value.length === 0) return null;

  // Remove símbolos de moeda comuns (R$, US$, €...)
  value = value.replace(/^(R\$|US\$|€|£)/i, "").trim();
  if (!/^[-+]?[\d.,]+$/.test(value)) return null;

  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos presentes: o que aparecer por último é o separador decimal
    const [thousandPart, decimalPart] =
      lastComma > lastDot
        ? value.split(",")
        : [value.slice(0, lastDot), value.slice(lastDot + 1)];
    const thousands = thousandPart.replace(/[.,]/g, "");
    return toNumber(`${thousands}.${decimalPart}`);
  }

  if (lastComma !== -1) {
    // Apenas vírgula: decimal (ex.: "1234,56"); múltiplas vírgulas = milhar ("1,234,567")
    const parts = value.split(",");
    if (parts.length > 2) {
      return toNumber(`${parts.slice(0, -1).join("")}.${parts.at(-1)}`);
    }
    return toNumber(value.replace(",", "."));
  }

  if (lastDot !== -1 && /^\+?-?\d{1,3}(\.\d{3})+$/.test(value)) {
    // Padrão de milhar: "1.234" ou "12.345.678"
    return toNumber(value.replace(/\./g, ""));
  }

  return toNumber(value);
}

function toNumber(raw: string): number | null {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Remove acentos, espaços extras, hífens; converte para MAIÚSCULAS_COM_UNDERSCORE. */
export function normalizeToken(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, "_");
}

/**
 * Compara um valor textual contra uma lista de valores permitidos,
 * ignorando acentos, caixa, espaços e hífens.
 * Retorna o valor canônico da lista ou `null`.
 */
export function normalizeEnumValue(
  input: string,
  allowedValues: readonly string[],
): string | null {
  const normalized = normalizeToken(input);
  if (normalized.length === 0) return null;
  return allowedValues.find((allowed) => normalizeToken(allowed) === normalized) ?? null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida se a string é um UUID (qualquer variante de versão). */
export function isUuid(input: string): boolean {
  return UUID_REGEX.test(input.trim());
}
