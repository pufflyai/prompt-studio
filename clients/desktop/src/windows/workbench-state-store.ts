import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopWorkbenchState } from "../desktop-api";

const readState = (path: string) => {
  if (!existsSync(path)) return { pageLocations: {}, kanbanViews: {} };
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { pageLocations: {}, kanbanViews: {} };
    const state = value as Partial<DesktopWorkbenchState>;
    const selectedProjectId = typeof state.selectedProjectId === "string" ? state.selectedProjectId : undefined;
    const pageLocations =
      state.pageLocations && typeof state.pageLocations === "object" && !Array.isArray(state.pageLocations)
        ? Object.fromEntries(Object.entries(state.pageLocations).filter((entry) => typeof entry[1] === "string"))
        : {};
    const kanbanViews =
      state.kanbanViews && typeof state.kanbanViews === "object" && !Array.isArray(state.kanbanViews)
        ? Object.fromEntries(
            Object.entries(state.kanbanViews).filter(
              ([key, value]) => key.startsWith("pstdio/ui/kanban-renderer/") && typeof value === "string",
            ),
          )
        : {};
    return { pageLocations, kanbanViews, ...(selectedProjectId ? { selectedProjectId } : {}) };
  } catch {
    return { pageLocations: {}, kanbanViews: {} };
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
    return {
      ...this.#state,
      pageLocations: { ...this.#state.pageLocations },
      kanbanViews: { ...this.#state.kanbanViews },
    };
  }

  setSelectedProjectId(projectId: string | null) {
    if (projectId) this.#state.selectedProjectId = projectId;
    else delete this.#state.selectedProjectId;
    this.#write();
  }

  setKanbanView(key: string, value: string | null) {
    if (value === null) delete this.#state.kanbanViews[key];
    else this.#state.kanbanViews[key] = value;
    this.#write();
  }

  setPageLocation(projectId: string, value: string | null) {
    if (value === null) delete this.#state.pageLocations[projectId];
    else this.#state.pageLocations[projectId] = value;
    this.#write();
  }

  #write() {
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, `${JSON.stringify(this.#state, null, 2)}\n`, "utf8");
  }
}
