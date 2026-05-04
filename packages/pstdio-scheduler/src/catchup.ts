import { toMinuteEpoch } from "./watermark-store";

export const findCatchupMinute = (input: { cron: string; lastWatermark: number | undefined; nowMinute: Date }) => {
  const { cron, lastWatermark, nowMinute } = input;
  if (lastWatermark === undefined) return null;

  let cursor = Bun.cron.parse(cron, new Date(lastWatermark * 60_000));
  if (cursor === null) return null;

  let previous: Date | null = null;

  for (let i = 0; i < 200_000; i += 1) {
    if (cursor.getTime() >= nowMinute.getTime()) break;

    previous = cursor;
    const next = Bun.cron.parse(cron, cursor);
    if (next === null) break;
    cursor = next;
  }

  if (previous === null) return null;
  if (toMinuteEpoch(previous) <= lastWatermark) return null;
  return previous;
};
