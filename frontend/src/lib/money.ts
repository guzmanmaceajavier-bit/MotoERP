export const fmtMoney = (n: number | string | null | undefined): string =>
  '$' + Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
