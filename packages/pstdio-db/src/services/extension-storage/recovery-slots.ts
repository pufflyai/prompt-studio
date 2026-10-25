export const recoveryHours = [1, 12, 24] as const;
export type RecoveryHours = (typeof recoveryHours)[number];

const hourMs = 3_600_000;

/** A point is due when it is missing or older than its period. */
export const dueRecoveryHours = (existing: { hours: number; capturedAt: string }[], now: Date) =>
  recoveryHours.filter((hours) => {
    const previous = existing.find((point) => point.hours === hours);
    return !previous || now.getTime() - Date.parse(previous.capturedAt) >= hours * hourMs;
  });

/**
 * Chooses which recovery points to write and drop. `room` is how many new points fit in the free
 * space. When it cannot hold every due point, only the 12-hour point stays.
 */
export const planRecoverySlots = (input: {
  existing: { hours: number; capturedAt: string }[];
  now: Date;
  room: number;
}) => {
  const { existing, now, room } = input;
  const due: RecoveryHours[] = dueRecoveryHours(existing, now);
  if (room >= due.length) return { write: due, drop: [] as RecoveryHours[] };
  return {
    write: due.includes(12) && room >= 1 ? [12 as const] : [],
    drop: recoveryHours.filter((hours) => hours !== 12 && existing.some((point) => point.hours === hours)),
  };
};
