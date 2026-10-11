import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const UPDATE_CHANNELS = ["stable", "nightly"] as const;
export type UpdateChannel = (typeof UPDATE_CHANNELS)[number];

export const isUpdateChannel = (value: unknown): value is UpdateChannel =>
  UPDATE_CHANNELS.some((channel) => channel === value);

// Nightlies are built only for macOS and Linux, so other platforms stay on stable.
export const updateChannelAvailable = (platform: NodeJS.Platform) => platform === "darwin" || platform === "linux";

// The choice belongs to this device, not to a runtime database, so a remote runtime
// never moves this app to nightly. The desktop app reads it before every update check.
export const readUpdateChannel = (path: string): UpdateChannel => {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { channel?: unknown } | null;
    return isUpdateChannel(value?.channel) ? value.channel : "stable";
  } catch {
    return "stable";
  }
};

export const writeUpdateChannel = (path: string, channel: UpdateChannel) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ channel })}\n`, "utf8");
};
