import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const readEnabled = (path: string) => {
  if (!existsSync(path)) return false;
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { enabled?: unknown } | null;
    return value?.enabled === true;
  } catch {
    return false;
  }
};

// The switch belongs to this device. It lives in Electron's user data, not in the
// runtime database, so a remote runtime never turns monitoring on here.
export class PerformanceMonitoringPreference {
  readonly #path: string;
  #enabled: boolean;

  constructor(path: string) {
    this.#path = path;
    this.#enabled = readEnabled(path);
  }

  get enabled() {
    return this.#enabled;
  }

  set(enabled: boolean) {
    this.#enabled = enabled;
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, `${JSON.stringify({ enabled })}\n`, "utf8");
  }
}
