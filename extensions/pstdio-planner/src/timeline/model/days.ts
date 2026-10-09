// Calendar-day helpers. Days are UTC "YYYY-MM-DD" strings so they sort and compare as text.
const dayMs = 86_400_000;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export const toDay = (iso: string) => iso.slice(0, 10);

// Date parsing rolls invalid days such as 02-30 forward, so the round trip must match.
export function isDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return dayPattern.test(value) && !Number.isNaN(time) && toDay(new Date(time).toISOString()) === value;
}

export const addDays = (day: string, count: number) =>
  toDay(new Date(Date.parse(`${day}T00:00:00Z`) + count * dayMs).toISOString());

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);
