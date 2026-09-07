import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardProjects, findDashboardProject } from "./data/project-data";
import { closeProjectTab, openProjectTab, reconcileProjectTabs } from "./desktop-project-tabs";

type ProjectContext = Pick<WorkbenchModuleContext, "context" | "commands">;

export class DesktopProjectTabsController {
  #projectIds: readonly string[];
  readonly #listeners = new Set<() => void>();
  readonly #persist: (state: { projectIds: string[] }) => Promise<void>;

  constructor(projectIds: string[], persist: (state: { projectIds: string[] }) => Promise<void>) {
    this.#projectIds = [...projectIds];
    this.#persist = persist;
  }

  getProjectIds = () => this.#projectIds;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #update(projectIds: readonly string[]) {
    if (
      projectIds.length === this.#projectIds.length &&
      projectIds.every((id, index) => this.#projectIds[index] === id)
    )
      return;
    this.#projectIds = projectIds;
    for (const listener of this.#listeners) listener();
    void this.#persist({ projectIds: [...projectIds] });
  }

  select(ctx: ProjectContext, projectId: string) {
    const project = findDashboardProject(projectId);
    if (!project) return Promise.resolve();
    return ctx.commands.executeCommand(dashboardCommandIds.selectProject, { project });
  }

  async close(ctx: ProjectContext, projectId: string) {
    const selected = getDashboardSelectedProjectId(ctx);
    const next = closeProjectTab(this.#projectIds, projectId, selected);
    this.#update(next.projectIds);
    if (selected !== projectId) return;
    if (next.selectedProjectId) await this.select(ctx, next.selectedProjectId);
    else await ctx.commands.executeCommand(dashboardCommandIds.clearSelectedProject);
  }

  connect(ctx: ProjectContext) {
    const syncSelection = () => {
      const selected = getDashboardSelectedProjectId(ctx);
      if (selected && findDashboardProject(selected)) this.#update(openProjectTab(this.#projectIds, selected));
    };
    const syncProjects = () => {
      if (!isInitialCollectionsSyncComplete()) return;
      const selected = getDashboardSelectedProjectId(ctx);
      const previous = this.#projectIds;
      const remaining = reconcileProjectTabs(
        previous,
        createDashboardProjects().map((project) => project.id),
      );
      this.#update(remaining);
      if (selected && !findDashboardProject(selected)) {
        const index = previous.indexOf(selected);
        const candidates = [...previous.slice(index + 1), ...previous.slice(0, index).reverse()];
        const fallback = candidates.find((id) => remaining.includes(id));
        if (fallback) void this.select(ctx, fallback);
        else void ctx.commands.executeCommand(dashboardCommandIds.clearSelectedProject);
      } else syncSelection();
    };
    const unsubscribeSelection = subscribeDashboardSelectedProject(ctx, syncSelection);
    const unsubscribeData = subscribeDashboardData(syncProjects);
    syncProjects();
    return {
      dispose: () => {
        unsubscribeSelection();
        unsubscribeData();
      },
    };
  }
}
