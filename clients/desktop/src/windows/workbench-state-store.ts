import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopStartupAppearance, DesktopWorkbenchState } from "../desktop-api";

// The renderer sends a burst of keys for each layout save; one disk write covers the burst.
const WRITE_DELAY_MS = 100;

const THEME_ID = /^[^\s"<>&]{1,200}$/;
// Token values become inline CSS on the lifecycle document. Reject anything that could
// end the declaration or the attribute instead of escaping it.
const TOKEN_PATH = /^[\w.-]{1,128}$/;
const TOKEN_VALUE = /^[^;{}<>"\\&]{1,256}$/;
// Electron's native window background accepts these formats.
const BACKGROUND_COLOR = /^(#[\da-f]{3,8}|rgba?\([\d\s.,%/]+\))$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValues = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
};

const parseStartupAppearance = (value: unknown): DesktopStartupAppearance | undefined => {
  if (!isRecord(value) || !isRecord(value.tokens)) return undefined;
  const { themeId, mode, backgroundColor } = value;
  if (typeof themeId !== "string" || !THEME_ID.test(themeId)) return undefined;
  if (mode !== "light" && mode !== "dark") return undefined;
  if (typeof backgroundColor !== "string" || !BACKGROUND_COLOR.test(backgroundColor)) return undefined;
  // An unsafe token is left out, so the rest of the theme still shows.
  const tokens = Object.entries(value.tokens).filter(
    (entry): entry is [string, string] =>
      TOKEN_PATH.test(entry[0]) && typeof entry[1] === "string" && TOKEN_VALUE.test(entry[1]),
  );
  return { themeId, mode, tokens: Object.fromEntries(tokens), backgroundColor };
};

const readState = (path: string): { values: Record<string, string>; startupAppearance?: DesktopStartupAppearance } => {
  if (!existsSync(path)) return { values: {} };
  try {
    const state = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!isRecord(state)) return { values: {} };
    const startupAppearance = parseStartupAppearance(state.startupAppearance);
    if (state.values !== undefined) return { values: stringValues(state.values), startupAppearance };

    // Earlier releases already kept project and page selection across restarts.
    const values = Object.fromEntries(
      Object.entries(stringValues(state.pageLocations)).map(([projectId, location]) => [
        `dashboard-wb2:page-location:${projectId}`,
        location,
      ]),
    );
    if (typeof state.selectedProjectId === "string") {
      values["dashboard-wb2:selected-project:global"] = state.selectedProjectId;
    }
    return { values, startupAppearance };
  } catch {
    // A missing or interrupted file starts with no saved workbench state.
    return { values: {} };
  }
};

export class DesktopWorkbenchStateStore {
  readonly #path: string;
  readonly #values: Record<string, string>;
  #startupAppearance: DesktopStartupAppearance | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(path: string) {
    this.#path = path;
    const { values, startupAppearance } = readState(path);
    this.#values = values;
    this.#startupAppearance = startupAppearance;
  }

  getState(): DesktopWorkbenchState {
    return { values: { ...this.#values } };
  }

  getStartupAppearance() {
    return this.#startupAppearance;
  }

  setItem(key: string, value: string | null) {
    if (value === null) delete this.#values[key];
    else this.#values[key] = value;
    this.#scheduleFlush();
  }

  setStartupAppearance(value: unknown) {
    const appearance = parseStartupAppearance(value);
    if (!appearance) throw new Error("Invalid startup appearance");
    this.#startupAppearance = appearance;
    this.#scheduleFlush();
    return appearance;
  }

  flush() {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    mkdirSync(dirname(this.#path), { recursive: true });
    const content = { values: this.#values, startupAppearance: this.#startupAppearance };
    writeFileSync(`${this.#path}.tmp`, `${JSON.stringify(content)}\n`, "utf8");
    renameSync(`${this.#path}.tmp`, this.#path);
  }

  #scheduleFlush() {
    this.#timer ??= setTimeout(() => this.flush(), WRITE_DELAY_MS);
  }
}
