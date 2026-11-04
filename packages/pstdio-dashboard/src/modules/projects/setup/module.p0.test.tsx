import { expect, test } from "bun:test";
import { createWorkbench, type LayoutPersistenceAdapter, type WorkbenchLayout } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { setDashboardExtensionsReadyProject } from "@/shared/extensions/extension-readiness";
import {
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createProjectOpeningModule } from "./module";

const fixture = (layoutPersistence?: LayoutPersistenceAdapter) => {
  const workbench = createWorkbench({ layoutPersistence });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.setActiveMode("project");
  const opening = createProjectOpeningModule();
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
  const project = Promise.withResolvers<{ id: string }>();
  try {
    const pending = opening.open(project.promise);
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    project.resolve({ id: "created" });
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

test("disabled, removed or hidden setup contributes no dialog after opening", async () => {
  const { workbench, opening, registration, ready } = fixture();
  try {
    const project = Promise.withResolvers<{ id: string }>();
    const pending = opening.open(project.promise);
    expect(workbench.layout.getActivePanel("overlay")).toBeUndefined();
    project.resolve({ id: "created" });
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
    await opening.open("created");
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
  const project = Promise.withResolvers<{ id: string }>();
  try {
    const pending = opening.open(project.promise);
    selectDashboardProject(workbench, { id: "other", name: "Other" });
    project.resolve({ id: "created" });
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
    const pending = opening.open(Promise.resolve({ id: "created" }));
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
  const project = Promise.withResolvers<{ id: string }>();
  try {
    const pending = opening.open(project.promise);
    workbench.host.setPersistenceScope(undefined);
    project.resolve({ id: "created" });
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

test("reload removes saved opening progress before extension data arrives", async () => {
  const saved = new Map<string, WorkbenchLayout>();
  const persistence = {
    getLayout: (scope?: string) => saved.get(scope ?? "global"),
    setLayout: (layout: WorkbenchLayout, scope?: string) => {
      saved.set(scope ?? "global", structuredClone(layout));
    },
  };
  const first = createWorkbench({ layoutPersistence: persistence });
  // A layout written by the former early-progress implementation must remain harmless.
  first.views.registerView({
    id: "dashboard.project-opening",
    title: "Legacy setup progress",
    body: { kind: "react", render: () => null },
  });
  first.overlays.registerOverlay({ id: "dashboard.project-opening", viewId: "dashboard.project-opening" });
  first.overlays.openOverlay("dashboard.project-opening");
  first.host.setPersistenceScope("project/created");
  expect(saved.get("global")!.regions.overlay.widgets.length).toBeGreaterThan(0);
  const restored = createWorkbench({ layoutPersistence: persistence });
  const resumed = restored.registerModule(createProjectOpeningModule().module);
  try {
    expect(restored.layout.getActivePanel("overlay")).toBeUndefined();
  } finally {
    resumed.dispose();
  }
});

test.each([
  false,
  true,
])("completed setup ownership is cleaned before late metadata restores a snapshot (legacy=%s)", async (legacy) => {
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
  await first.opening.open("created");
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
  if (legacy) {
    const placement = snapshot.regions.overlay.widgets.find((w) => w.viewId === "example.reload.view.setup")!;
    placement.contributionId = `workbench.overlay.${encodeURIComponent(placement.viewId!)}`;
    placement.widgetId = placement.contributionId;
    saved.set("global", snapshot);
  }
  expect(snapshot.regions.overlay.widgets.some((w) => w.viewId === "example.reload.view.setup")).toBe(true);
  const restored = fixture(persistence);
  try {
    if (legacy)
      expect(restored.workbench.layout.getPanel("workbench.overlay.example.reload.view.setup")).toBeUndefined();
    else
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
