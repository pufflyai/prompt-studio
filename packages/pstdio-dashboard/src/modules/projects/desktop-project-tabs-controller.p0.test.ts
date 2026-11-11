import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkbench, type WorkbenchCore } from "@pstdio/workbench";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { DesktopProjectTabsController } from "./desktop-project-tabs-controller";
import { createProjectsModule } from "./module";

const disposals: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
  getWriter("projects")?.truncateAndWrite([]);
  getWriter("workspaces")?.truncateAndWrite([]);
});

const writeProjects = (ids: string[]) => {
  getWriter("projects")?.truncateAndWrite(ids.map((id) => ({ id, name: id })));
  getWriter("workspaces")?.truncateAndWrite(
    ids.map((id) => ({ id: `${id}-workspace`, project_id: id, is_default: true, root_path: `/projects/${id}` })),
  );
};

const setup = (input: {
  projects?: string[];
  openIds?: string[];
  selected?: string;
  persist?: (state: { projectIds: string[] }) => Promise<void>;
}) => {
  const writes: string[][] = [];
  const disposed: WorkbenchCore[] = [];
  let selection: string | undefined;
  const tabs = new DesktopProjectTabsController(
    input.openIds ?? [],
    input.persist ??
      (async (state) => {
        writes.push(state.projectIds);
      }),
  );
  writeProjects(input.projects ?? ["first", "second"]);
  markInitialCollectionsSyncComplete();
  tabs.start({
    projectId: input.selected,
    persistence: {
      getSelectedProjectId: () => selection,
      setSelectedProjectId: (id) => {
        selection = id;
      },
    },
    createWorkbench: (projectId, active) => {
      const workbench = createWorkbench({ active });
      const dispose = workbench.dispose;
      workbench.dispose = () => {
        disposed.push(workbench);
        return dispose();
      };
      workbench.registerModule(
        createProjectsModule({ projectTabs: tabs.forWorkbench(projectId), initialProjectId: projectId }),
      );
      return workbench;
    },
  });
  const connection = tabs.connect();
  disposals.push(() => {
    connection.dispose();
    tabs.dispose();
  });
  // The dashboard disposes released workbenches after React stops rendering them.
  const render = () => tabs.disposeReleased();
  const workbenchOf = (projectId: string | undefined) =>
    tabs.getState().workbenches.find((entry) => entry.projectId === projectId)?.workbench;
  return { tabs, writes, disposed, render, workbenchOf, selection: () => selection };
};

test("keeps each visited tab's workbench loaded and shows it again without recreating it", () => {
  const { tabs, disposed, render, workbenchOf, selection } = setup({});
  const picker = tabs.getActiveWorkbench();
  tabs.select("first");
  render();
  const first = workbenchOf("first")!;
  expect(disposed).toEqual([picker!]);
  tabs.select("second");
  const second = workbenchOf("second")!;
  tabs.select("first");
  render();

  expect(tabs.getActiveWorkbench()).toBe(first);
  expect(first.activation.isActive()).toBe(true);
  expect(second.activation.isActive()).toBe(false);
  expect(getDashboardSelectedProjectId(first)).toBe("first");
  expect(getDashboardSelectedProjectId(second)).toBe("second");
  expect(tabs.getProjectIds()).toEqual(["first", "second"]);
  expect(disposed).toEqual([picker!]);
  expect(selection()).toBe("first");
});

test("selecting a project inside a workbench shows that project's tab and leaves the workbench bound", async () => {
  const { tabs, workbenchOf } = setup({ selected: "first" });
  const first = workbenchOf("first")!;
  await first.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id: "second", name: "second" } });

  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("second"));
  expect(getDashboardSelectedProjectId(first)).toBe("first");
  expect(first.activation.isActive()).toBe(false);
});

test("closing a tab releases only its workbench and shows the next tab", () => {
  const { tabs, disposed, render, workbenchOf } = setup({ projects: ["first", "second", "third"], selected: "first" });
  tabs.select("second");
  tabs.select("third");
  const first = workbenchOf("first")!;
  const second = workbenchOf("second")!;

  tabs.close("first");
  render();
  expect(disposed).toEqual([first]);
  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("third"));

  tabs.close("third");
  render();
  expect(tabs.getActiveWorkbench()).toBe(second);
  expect(tabs.getProjectIds()).toEqual(["second"]);
});

test("closing the last tab shows project selection and keeps it when project data changes", () => {
  const { tabs, render, workbenchOf } = setup({ projects: ["first"], selected: "first" });
  tabs.close("first");
  render();
  getWriter("projects")?.upsert({ id: "first", name: "Renamed project" });

  expect(tabs.getState().workbenches).toHaveLength(1);
  expect(workbenchOf(undefined)).toBe(tabs.getActiveWorkbench());
  expect(getDashboardSelectedProjectId(tabs.getActiveWorkbench()!)).toBeUndefined();
  expect(tabs.getProjectIds()).toEqual([]);
});

test("reordering saves the new tab order without changing the visible project", () => {
  const { tabs, writes, workbenchOf } = setup({
    projects: ["first", "second", "third"],
    openIds: ["first", "second", "third"],
    selected: "second",
  });
  tabs.reorder("first", "third");
  expect(tabs.getProjectIds()).toEqual(["second", "third", "first"]);
  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("second"));
  expect(writes.at(-1)).toEqual(["second", "third", "first"]);
});

test("removes deleted projects' tabs and workbenches and falls back to the next tab", () => {
  const { tabs, disposed, render, workbenchOf } = setup({
    projects: ["first", "second", "third"],
    openIds: ["second", "deleted", "first", "third"],
    selected: "second",
  });
  expect(tabs.getProjectIds()).toEqual(["second", "first", "third"]);
  tabs.select("third");
  tabs.select("second");
  const second = workbenchOf("second")!;
  const third = workbenchOf("third")!;

  writeProjects(["first"]);
  render();
  expect(tabs.getProjectIds()).toEqual(["first"]);
  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("first"));
  expect(disposed).toEqual(expect.arrayContaining([second, third]));
});

test("reports a failed tab write and clears the error after the next saved change", async () => {
  const home = mkdtempSync(join(tmpdir(), "project-tabs-persistence-"));
  disposals.push(() => rmSync(home, { recursive: true, force: true }));
  const blockedDirectory = join(home, "app-data");
  writeFileSync(blockedDirectory, "blocks the application data directory");
  const path = join(blockedDirectory, "project-tabs.json");
  let save: Promise<void> = Promise.resolve();
  const { tabs } = setup({
    projects: ["first"],
    persist: (state) => {
      save = Bun.write(path, JSON.stringify(state)).then(() => {});
      return save;
    },
  });

  tabs.select("first");
  await expect(save).rejects.toThrow();
  expect(tabs.getProjectIds()).toEqual(["first"]);
  expect(tabs.getActiveWorkbench()?.notifications.listNotifications()).toMatchObject([{ level: "error" }]);

  rmSync(blockedDirectory);
  tabs.close("first");
  await save;
  expect(await Bun.file(path).json()).toEqual({ projectIds: [] });
  for (const entry of tabs.getState().workbenches)
    expect(entry.workbench.notifications.listNotifications()).toEqual([]);
});

test("a project created in this window opens in its tab once its row syncs", () => {
  const { tabs, workbenchOf } = setup({ selected: "first" });
  tabs.select("created");
  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("first"));

  writeProjects(["first", "second", "created"]);
  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("created"));
  expect(tabs.getProjectIds()).toEqual(["first", "created"]);
});

test("a background workbench cannot change the visible tab", async () => {
  const { tabs, workbenchOf } = setup({ selected: "first" });
  tabs.select("second");
  const first = workbenchOf("first")!;
  await first.commands.executeCommand(dashboardCommandIds.clearSelectedProject);
  await first.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id: "first", name: "first" } });

  expect(tabs.getActiveWorkbench()).toBe(workbenchOf("second"));
});
