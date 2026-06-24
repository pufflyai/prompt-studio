const DURATION_RE = /^(\d+)([smhd])$/;

const offsetMs = (value: number, unit: string) => {
  const s = 1000;
  const m = 60 * s;
  const h = 60 * m;
  const d = 24 * h;
  switch (unit) {
    case "s":
      return value * s;
    case "m":
      return value * m;
    case "h":
      return value * h;
    case "d":
      return value * d;
    default:
      return 0;
  }
};

export const resolveSnoozeUntil = (input: string, now = new Date()) => {
  const match = DURATION_RE.exec(input);
  if (match) {
    const value = Number(match[1]);
    const unit = match[2];
    return new Date(now.getTime() + offsetMs(value, unit)).toISOString();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid snooze deadline: ${input}`);
  }
  return parsed.toISOString();
};
