import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopWorkbenchState } from "../desktop-api";

const readState = (path: string) => {
  if (!existsSync(path)) return { lastResources: {} };
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { lastResources: {} };
    const state = value as Partial<DesktopWorkbenchState>;
    const selectedProjectId = typeof state.selectedProjectId === "string" ? state.selectedProjectId : undefined;
    const lastResources =
      state.lastResources && typeof state.lastResources === "object" && !Array.isArray(state.lastResources)
        ? Object.fromEntries(Object.entries(state.lastResources).filter((entry) => typeof entry[1] === "string"))
        : {};
    return { lastResources, ...(selectedProjectId ? { selectedProjectId } : {}) };
  } catch {
    return { lastResources: {} };
  }
};

export class DesktopWorkbenchStateStore {
  readonly #path: string;
  readonly #state: DesktopWorkbenchState;

  constructor(path: string) {
    this.#path = path;
    this.#state = readState(path);
  }

  getState() {
    return { ...this.#state, lastResources: { ...this.#state.lastResources } };
  }

  setSelectedProjectId(projectId: string | null) {
    if (projectId) this.#state.selectedProjectId = projectId;
    else delete this.#state.selectedProjectId;
    this.#write();
  }

  setLastResource(projectId: string, value: string | null) {
    if (value === null) delete this.#state.lastResources[projectId];
    else this.#state.lastResources[projectId] = value;
    this.#write();
  }

  #write() {
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, `${JSON.stringify(this.#state, null, 2)}\n`, "utf8");
  }
}
