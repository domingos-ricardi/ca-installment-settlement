/** Formatadores de datas e valores para exibição na interface. */

/** Converte AAAA-MM-DD para DD/MM/AAAA; retorna "—" quando inválido. */
export function formatIsoDateBr(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  if (!match) return "—";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Formata número como moeda BRL; retorna "—" quando não numérico. */
export function formatCurrencyBrl(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Data ISO (AAAA-MM-DD) de hoje deslocada em N dias (horário local). */
export function isoDaysFromToday(deltaDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + deltaDays);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
