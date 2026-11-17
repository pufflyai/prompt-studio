import { expect, test } from "bun:test";
import { createWorkbench, type LayoutPersistenceAdapter, type WorkbenchLayout } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { setDashboardExtensionsReadyProject } from "@/shared/extensions/extension-readiness";
import {
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createProjectOpeningModule } from "./module";
import { createProjectSetupHandoff, type ProjectSetupHandoff } from "./project-setup-handoff";

const fixture = (layoutPersistence?: LayoutPersistenceAdapter, handoff?: ProjectSetupHandoff) => {
  const workbench = createWorkbench({ layoutPersistence });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.setActiveMode("project");
  const opening = createProjectOpeningModule({ handoff });
  const registration = workbench.registerModule(opening.module);
  const ready = (ids: string[] = ["example.setup"]) => {
    for (const id of ids)
      if (!workbench.views.getView(`${id}.view.setup`))
        workbench.views.registerView({
          id: `${id}.view.setup`,
          title: "Example setup",
          body: { kind: "react", render: () => null },
        });
    setCachedDashboardExtensionMetadata("created", {
      ...emptyDashboardExtensionMetadata,
      projectSetups: ids.map((extensionId) => ({ extensionId, view: { extensionId, kind: "view", id: "setup" } })),
    });
    setDashboardExtensionsReadyProject(workbench, "created");
  };
  return { workbench, opening, registration, ready };
};

test("waits for project creation and authoritative enabled setup before showing an overlay", async () => {
  const { workbench, opening, registration, ready } = fixture();
  const project = Promise.withResolvers<{ id: string; created: boolean }>();
  try {
    const pending = opening.open(project.promise);
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    project.resolve({ id: "created", created: true });
    await Promise.resolve();
    selectDashboardProject(workbench, { id: "created", name: "Created" });
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    ready();
    await pending;
    expect(workbench.layout.getActivePanel("overlay")?.viewId).toBe("example.setup.view.setup");
  } finally {
    registration.dispose();
  }
});

test("a desktop tab shows the setup of the project another tab created", async () => {
  const handoff = createProjectSetupHandoff();
  const creator = fixture(undefined, handoff);
  try {
    await creator.opening.open(Promise.resolve({ id: "created", created: true }));
    const created = fixture(undefined, handoff);
    try {
      selectDashboardProject(created.workbench, { id: "created", name: "Created" });
      created.ready();
      await Bun.sleep(0);
      expect(created.workbench.layout.getActivePanel("overlay")?.viewId).toBe("example.setup.view.setup");
      expect(creator.workbench.layout.getActivePanel("overlay")).toBeUndefined();
    } finally {
      created.registration.dispose();
    }
  } finally {
    creator.registration.dispose();
  }
});

test("reopening an existing project's folder does not replay setup", async () => {
  const { workbench, opening, registration, ready } = fixture();
  try {
    selectDashboardProject(workbench, { id: "created", name: "Created" });
    ready();
    await opening.open(Promise.resolve({ id: "created", created: false }));
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    ready();
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    registration.dispose();
  }
});

test("disabled, removed or hidden setup contributes no dialog after opening", async () => {
  const { workbench, opening, registration, ready } = fixture();
  try {
    const project = Promise.withResolvers<{ id: string; created: boolean }>();
    const pending = opening.open(project.promise);
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    project.resolve({ id: "created", created: true });
    await Promise.resolve();
    selectDashboardProject(workbench, { id: "created", name: "Created" });
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    ready([]);
    await pending;
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    registration.dispose();
  }
});

test("a dismissed eligible setup never reopens on later metadata refresh", async () => {
  const { workbench, opening, registration, ready } = fixture();
  try {
    selectDashboardProject(workbench, { id: "created", name: "Created" });
    ready();
    await opening.open(Promise.resolve({ id: "created", created: true }));
    const placement = workbench.layout.getActivePanel("overlay")!;
    workbench.overlays.closeOverlay(placement.instanceId);
    ready();
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    registration.dispose();
  }
});

test("an unrelated project switch cancels the pending setup handoff", async () => {
  const { workbench, opening, registration, ready } = fixture();
  const project = Promise.withResolvers<{ id: string; created: boolean }>();
  try {
    const pending = opening.open(project.promise);
    selectDashboardProject(workbench, { id: "other", name: "Other" });
    project.resolve({ id: "created", created: true });
    ready();
    await pending;
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    registration.dispose();
  }
});

test("disabling or removing the active setup contribution closes its nonclosable overlay", async () => {
  const { workbench, opening, registration, ready } = fixture();
  try {
    const pending = opening.open(Promise.resolve({ id: "created", created: true }));
    await Promise.resolve();
    selectDashboardProject(workbench, { id: "created", name: "Created" });
    ready();
    await pending;
    expect(workbench.layout.getActivePanel("overlay")?.viewId).toBe("example.setup.view.setup");
    ready([]);
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    registration.dispose();
  }
});

test("an opening with no eligible setup remains absent across persistence scopes", async () => {
  const { workbench, opening, registration, ready } = fixture();
  workbench.host.setPersistenceScope("project/previous");
  const project = Promise.withResolvers<{ id: string; created: boolean }>();
  try {
    const pending = opening.open(project.promise);
    workbench.host.setPersistenceScope(undefined);
    project.resolve({ id: "created", created: true });
    await Promise.resolve();
    selectDashboardProject(workbench, { id: "created", name: "Created" });
    workbench.host.setPersistenceScope("project/created");
    ready([]);
    await pending;
    workbench.host.setPersistenceScope("project/previous");
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    registration.dispose();
  }
});

test("completed setup ownership is cleaned before late metadata restores a snapshot", async () => {
  const saved = new Map<string, WorkbenchLayout>();
  const persistence = {
    getLayout: (scope?: string) => saved.get(scope ?? "global"),
    setLayout: (layout: WorkbenchLayout, scope?: string) => {
      saved.set(scope ?? "global", structuredClone(layout));
    },
  };
  const first = fixture(persistence);
  selectDashboardProject(first.workbench, { id: "created", name: "Created" });
  first.ready(["example.reload"]);
  await first.opening.open(Promise.resolve({ id: "created", created: true }));
  first.workbench.views.registerView({
    id: "ordinary",
    title: "Ordinary dialog",
    body: { kind: "react", render: () => null },
  });
  first.workbench.overlays.registerOverlay({ id: "ordinary", viewId: "ordinary" });
  const ordinary = first.workbench.overlays.openOverlay("ordinary");
  first.workbench.host.setPersistenceScope("project/created");
  first.workbench.overlays.closeOverlay(first.workbench.layout.getActivePanel("overlay")!.instanceId);
  first.registration.dispose();
  const snapshot = structuredClone(saved.get("global")!);
  expect(snapshot.regions.overlay.widgets.some((w) => w.viewId === "example.reload.view.setup")).toBe(true);
  const restored = fixture(persistence);
  try {
    expect(restored.workbench.layout.getLayout().regions.overlay.widgets.map((w) => w.widgetId)).toEqual([ordinary]);
    // applyMetadata commits registrations/metadata before replaying its captured layout.
    restored.workbench.views.registerView({
      id: "ordinary",
      title: "Ordinary dialog",
      body: { kind: "react", render: () => null },
    });
    restored.workbench.overlays.registerOverlay({ id: "ordinary", viewId: "ordinary" });
    selectDashboardProject(restored.workbench, { id: "created", name: "Created" });
    restored.ready(["example.reload"]);
    restored.workbench.layout.restoreLayout(snapshot);
    expect(restored.workbench.layout.getLayout().regions.overlay.widgets.map((w) => w.widgetId)).toEqual([ordinary]);
  } finally {
    restored.registration.dispose();
  }
});
