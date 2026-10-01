import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopWorkbenchState } from "../desktop-api";

// The renderer sends a burst of keys for each layout save; one disk write covers the burst.
const WRITE_DELAY_MS = 100;

const readValues = (path: string): Record<string, string> => {
  if (!existsSync(path)) return {};
  try {
    const state = JSON.parse(readFileSync(path, "utf8")) as Partial<DesktopWorkbenchState> | null;
    const values = state?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) return {};
    return Object.fromEntries(Object.entries(values).filter((entry) => typeof entry[1] === "string"));
  } catch {
    // A missing or interrupted file starts with no saved workbench state.
    return {};
  }
};

export class DesktopWorkbenchStateStore {
  readonly #path: string;
  readonly #values: Record<string, string>;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(path: string) {
    this.#path = path;
    this.#values = readValues(path);
  }

  getState(): DesktopWorkbenchState {
    return { values: { ...this.#values } };
  }

  setItem(key: string, value: string | null) {
    if (value === null) delete this.#values[key];
    else this.#values[key] = value;
    this.#timer ??= setTimeout(() => this.flush(), WRITE_DELAY_MS);
  }

  flush() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(`${this.#path}.tmp`, `${JSON.stringify({ values: this.#values })}\n`, "utf8");
    renameSync(`${this.#path}.tmp`, this.#path);
  }
}
