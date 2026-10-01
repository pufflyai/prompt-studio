import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopWorkbenchState } from "../desktop-api";

// The renderer sends a burst of keys for each layout save; one disk write covers the burst.
const WRITE_DELAY_MS = 100;

const stringValues = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === "string"));
};

const readValues = (path: string): Record<string, string> => {
  if (!existsSync(path)) return {};
  try {
    const state = JSON.parse(readFileSync(path, "utf8")) as
      | (Partial<DesktopWorkbenchState> & { selectedProjectId?: unknown; pageLocations?: unknown })
      | null;
    if (state?.values !== undefined) return stringValues(state.values);

    // Earlier releases already kept project and page selection across restarts.
    const values = Object.fromEntries(
      Object.entries(stringValues(state?.pageLocations)).map(([projectId, location]) => [
        `dashboard-wb2:page-location:${projectId}`,
        location,
      ]),
    );
    if (typeof state?.selectedProjectId === "string") {
      values["dashboard-wb2:selected-project:global"] = state.selectedProjectId;
    }
    return values;
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
