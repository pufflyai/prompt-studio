import type { WatermarkStore } from "./types";

export const toMinuteEpoch = (value: Date) => Math.floor(value.getTime() / 60_000);

export const floorToMinute = (value: Date) => new Date(toMinuteEpoch(value) * 60_000);

export const parseWatermarks = (raw: string) => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const watermarks = new Map<string, number>();

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    watermarks.set(key, value);
  }

  return watermarks;
};

export const serializeWatermarks = (watermarks: Map<string, number>) => {
  const payload = Object.fromEntries([...watermarks.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const createInMemoryWatermarkStore = (): WatermarkStore => {
  let snapshot = new Map<string, number>();

  return {
    async load() {
      return new Map(snapshot);
    },
    async save(watermarks) {
      snapshot = new Map(watermarks);
    },
  };
};
