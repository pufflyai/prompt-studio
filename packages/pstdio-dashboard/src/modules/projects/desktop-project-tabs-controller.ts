import { createWorkbenchStore, type WorkbenchCore } from "@pstdio/workbench";
import { createCollectionSelection } from "@/lib/sync/collection-selection";
import { getRuntimeCollections, isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { createDashboardProjects, findDashboardProject } from "./data/project-data";
import { closeProjectTab, openProjectTab, reconcileProjectTabs, reorderProjectTab } from "./desktop-project-tabs";

const persistenceErrorId = "dashboard.project-tabs.persistence-error";

export interface DesktopProjectWorkbench {
  /** Stable React identity; a reopened project gets a new workbench and a new key. */
  key: number;
  /** The project this workbench shows for its whole life. Without one, it shows project selection. */
  projectId: string | undefined;
  workbench: WorkbenchCore;
}

interface DesktopProjectTabsState {
  projectIds: readonly string[];
  workbenches: readonly DesktopProjectWorkbench[];
  active: DesktopProjectWorkbench | undefined;
}

interface StartDesktopProjectTabsInput {
  createWorkbench: (projectId: string | undefined, active: boolean) => WorkbenchCore;
  persistence: DashboardProjectSelectionPersistence;
  projectId: string | undefined;
}

/**
 * Owns the desktop window's project tabs and one workbench per visited open tab. Only this
 * controller changes which workbench is visible; a workbench never switches to another project.
 */
export class DesktopProjectTabsController {
  readonly #store = createWorkbenchStore<DesktopProjectTabsState>({
    name: "dashboard.project-tabs",
    initialState: { projectIds: [], workbenches: [], active: undefined },
  });
  readonly #persist: (state: { projectIds: string[] }) => Promise<void>;
  #start: StartDesktopProjectTabsInput | undefined;
  #nextKey = 0;
  #stopWaiting: (() => void) | undefined;
  // Released workbenches are disposed after React stops rendering them.
  #released: WorkbenchCore[] = [];

  constructor(projectIds: string[], persist: (state: { projectIds: string[] }) => Promise<void>) {
    this.#store.setState({ projectIds: [...projectIds] });
    this.#persist = persist;
  }

  getProjectIds = () => this.#store.getState().projectIds;
  subscribe = (listener: () => void) => this.#store.subscribeSelector((state) => state.projectIds, listener);
  getState = () => this.#store.getState();
  subscribeState = (listener: () => void) => this.#store.subscribe(listener);
  getActiveWorkbench = () => this.#store.getState().active?.workbench;

  /** Creates the visible workbench. Restored tabs load when first selected. */
  start(input: StartDesktopProjectTabsInput) {
    this.#start = input;
    const active = this.#create(input.projectId, true);
    this.#store.setState({ workbenches: [active], active }, false, "startProjectTabs");
  }

  select(projectId: string) {
    this.#stopWaiting?.();
    this.#stopWaiting = undefined;
    if (findDashboardProject(projectId)) {
      this.#updateTabs(openProjectTab(this.getProjectIds(), projectId));
      this.#show(projectId);
      return;
    }
    // A project created in this window is selected before its row syncs; open its tab once it arrives.
    const selection = createCollectionSelection(getRuntimeCollections(), { tables: ["projects"] });
    const unsubscribe = selection.subscribe(() => {
      if (findDashboardProject(projectId)) this.select(projectId);
    });
    this.#stopWaiting = unsubscribe;
  }

  /** Shows project selection, for example after the visible project is deleted. */
  clear() {
    this.#stopWaiting?.();
    this.#stopWaiting = undefined;
    this.#show(undefined);
  }

  /**
   * The tab actions of one workbench. Only the visible workbench may change the visible tab, so
   * work that finishes in a background project never switches away from what the person sees.
   */
  forWorkbench(projectId: string | undefined) {
    const visible = () => this.#store.getState().active?.projectId === projectId;
    return {
      select: (target: string) => {
        if (visible()) this.select(target);
      },
      clear: () => {
        if (visible()) this.clear();
      },
    };
  }

  close(projectId: string) {
    const selected = this.#store.getState().active?.projectId;
    const next = closeProjectTab(this.getProjectIds(), projectId, selected);
    this.#updateTabs(next.projectIds);
    if (selected !== projectId) this.#release((entry) => entry.projectId === projectId);
    else if (next.selectedProjectId) this.select(next.selectedProjectId);
    else this.#show(undefined);
  }

  reorder(projectId: string, targetId: string) {
    this.#updateTabs(reorderProjectTab(this.getProjectIds(), projectId, targetId));
  }

  connect() {
    const syncProjects = () => {
      if (!isInitialCollectionsSyncComplete()) return;
      const previous = this.getProjectIds();
      const remaining = reconcileProjectTabs(
        previous,
        createDashboardProjects().map((project) => project.id),
      );
      this.#updateTabs(remaining);
      this.#release((entry) => entry.projectId !== undefined && !remaining.includes(entry.projectId));
      const selected = this.#store.getState().active?.projectId;
      if (!selected) return;
      if (findDashboardProject(selected)) {
        this.#updateTabs(openProjectTab(this.getProjectIds(), selected));
        return;
      }
      const index = previous.indexOf(selected);
      const candidates = [...previous.slice(index + 1), ...previous.slice(0, index).reverse()];
      const fallback = candidates.find((id) => remaining.includes(id));
      if (fallback) this.select(fallback);
      else this.clear();
    };
    const unsubscribe = createCollectionSelection(getRuntimeCollections(), { tables: ["projects"] }).subscribe(
      syncProjects,
    );
    syncProjects();
    return { dispose: unsubscribe };
  }

  /** Disposes the workbenches that are no longer rendered. */
  disposeReleased() {
    for (const workbench of this.#released.splice(0)) void workbench.dispose();
  }

  dispose() {
    this.#stopWaiting?.();
    this.#stopWaiting = undefined;
    this.#released.push(...this.#store.getState().workbenches.map((entry) => entry.workbench));
    this.#store.setState({ workbenches: [], active: undefined }, false, "disposeProjectTabs");
    this.disposeReleased();
  }

  #create(projectId: string | undefined, active: boolean): DesktopProjectWorkbench {
    if (!this.#start) throw new Error("Desktop project tabs have not started");
    return { key: this.#nextKey++, projectId, workbench: this.#start.createWorkbench(projectId, active) };
  }

  #isRetained(entry: DesktopProjectWorkbench) {
    return entry.projectId !== undefined && this.getProjectIds().includes(entry.projectId);
  }

  #show(projectId: string | undefined) {
    const { active, workbenches } = this.#store.getState();
    this.#start?.persistence.setSelectedProjectId(projectId);
    if (active && active.projectId === projectId) return;
    const existing = workbenches.find((entry) => entry.projectId === projectId);
    const next = existing ?? this.#create(projectId, false);
    // Exactly one workbench is active: deactivate the previous one first.
    active?.workbench.activation.setActive(false);
    next.workbench.activation.setActive(true);
    const kept = workbenches.filter((entry) => entry === next || entry !== active || this.#isRetained(entry));
    if (active && !kept.includes(active)) this.#released.push(active.workbench);
    this.#store.setState(
      { workbenches: existing ? kept : [...kept, next], active: next },
      false,
      "showProjectWorkbench",
    );
  }

  // Releases background workbenches; the visible one is released only by showing another.
  #release(matches: (entry: DesktopProjectWorkbench) => boolean) {
    const { active, workbenches } = this.#store.getState();
    const released = workbenches.filter((entry) => matches(entry) && entry !== active);
    if (released.length === 0) return;
    this.#released.push(...released.map((entry) => entry.workbench));
    this.#store.setState(
      { workbenches: workbenches.filter((entry) => !released.includes(entry)) },
      false,
      "releaseProjectWorkbench",
    );
  }

  #updateTabs(projectIds: readonly string[]) {
    const current = this.getProjectIds();
    if (projectIds.length === current.length && projectIds.every((id, index) => current[index] === id)) return;
    this.#store.setState({ projectIds }, false, "updateProjectTabs");
    void this.#persist({ projectIds: [...projectIds] }).then(
      () => {
        for (const entry of this.#store.getState().workbenches)
          entry.workbench.notifications.dismiss(persistenceErrorId);
      },
      (error: unknown) => {
        console.error("[dashboard.project-tabs] Could not save project tabs.", error);
        this.getActiveWorkbench()?.notifications.show({
          id: persistenceErrorId,
          level: "error",
          title: "Could not save project tabs",
          message:
            "Check that Prompt Studio can write to its application data folder, then open or close a tab to try saving again. Your latest tab order may not survive a restart.",
        });
      },
    );
  }
}
