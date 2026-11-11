// Local calendar dates as 'YYYY-MM-DD' strings -- the same shape Postgres
// `date` columns come back in. Always the browser's time zone, so "today"
// flips at local midnight rather than UTC midnight.

export function dayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDay(key: string, days: number) {
  const d = parseDay(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}
