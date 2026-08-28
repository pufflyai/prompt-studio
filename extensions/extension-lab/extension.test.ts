import { describe, expect, test } from "bun:test";
import extension from "./extension";
import { labArtifactsChanged } from "./src/events";

const commandMenus = () => Object.values(extension.commands ?? {}).flatMap((command) => command.menus ?? []);
const commandPalettes = () => Object.values(extension.commands ?? {}).flatMap((command) => command.palette ?? []);
const view = (id: string) => extension.views?.find((candidate) => candidate.id === id);

describe("extension-lab workbench attachments", () => {
  test("refreshes artifact renderers from the shared artifact event", () => {
    expect(view("artifacts")?.body.refreshEvents).toEqual([labArtifactsChanged]);
    expect(view("artifact-create")?.body.refreshEvents).toEqual([labArtifactsChanged]);
    expect(view("workflow")?.body.refreshEvents).toEqual([labArtifactsChanged]);
  });

  test("uses stored artifact resources as movable workflow rows", async () => {
    const artifacts = new Map<string, Record<string, unknown>>();
    const values = new Map<string, unknown>();
    const emitted: string[] = [];
    const storage = {
      get: async (key: string) => values.get(key),
      set: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      collection: () => ({
        get: async (id: string) => artifacts.get(id),
        list: async () => [...artifacts.values()],
        put: async (id: string, value: Record<string, unknown>) => {
          artifacts.set(id, value);
        },
        delete: async (id: string) => {
          artifacts.delete(id);
        },
      }),
    };
    const events = {
      emit: async (event: string | { id: string }) => {
        emitted.push(typeof event === "string" ? event : event.id);
        return { delivered: 0 };
      },
    };
    const workflow = view("workflow")?.body;
    if (workflow?.kind !== "kanban") throw new Error("Workflow Kanban view is missing.");

    const initial = await workflow.query({ events, storage } as never, {} as never);
    expect(initial.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "concept",
          attributes: { status: "idea" },
          resource: expect.objectContaining({ type: "glass-lab-artifact", id: "concept" }),
        }),
      ]),
    );
    expect(workflow.onAttributeChange).toBeFunction();

    await workflow.onAttributeChange?.({ events, storage } as never, {
      rowId: "concept",
      attributeId: "status",
      value: "testing",
    });

    const moved = await workflow.query({ events, storage } as never, {} as never);
    expect(moved.rows.find((row) => row.id === "concept")).toMatchObject({
      attributes: { status: "testing" },
      resource: { metadata: { status: "testing" } },
    });
    expect(artifacts.get("concept")).toMatchObject({ status: "testing" });
    expect(emitted).toContain("artifacts.changed");
  });

  test("exercises PS-313 attachment targets", () => {
    expect(commandMenus()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: expect.objectContaining({ id: "project.headerPrimary" }) }),
        expect.objectContaining({ slot: expect.objectContaining({ id: "project.headerOverflow" }) }),
        expect.objectContaining({
          slot: expect.objectContaining({ id: "workspace.headerPrimary" }),
          when: {
            resourceType: [{ extensionId: "pstdio", id: "workspace", kind: "resource-kind" }],
          },
        }),
      ]),
    );
    expect(commandPalettes()).toEqual(expect.arrayContaining([expect.objectContaining({ group: "Lab" })]));
    expect(commandPalettes()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.objectContaining({ $l10n: "commands.counter.read.title" }) }),
      ]),
    );
    expect(view("artifacts")).toMatchObject({
      title: { $l10n: "panels.labArtifacts.title", default: "Artifacts" },
      body: {
        kind: "dataTable",
        query: expect.any(Function),
        rowActions: [
          {
            id: "delete",
            label: "Delete artifact",
            icon: "trash",
            destructive: true,
            command: { id: "glass-lab-artifacts.delete", kind: "command" },
          },
        ],
      },
    });
    expect(extension.navigationItems?.find((item) => item.id === "lab")).toMatchObject({
      action: {
        kind: "command",
        target: {
          command: {
            extensionId: "pstdio",
            kind: "command",
            id: "workbench.action.switchMode",
          },
          params: { modeId: "pstdio.extension-lab.mode.lab" },
        },
      },
    });
  });

  test("stages a single Lab mode with native activity items and status chrome", () => {
    // Lab is the mode-wide workspace; Animation and Sculpt are the conformance
    // fixture that arranges one shared blend-project resource two ways.
    expect(extension.modes?.map((mode) => mode.id)).toEqual(["lab", "animation", "sculpt"]);
    expect(extension.modes?.[0]).toMatchObject({
      id: "lab",
      ref: { kind: "mode", id: "lab" },
    });
    expect(extension.activityItems?.find((item) => item.id === "create-artifact")).toMatchObject({
      icon: "package-plus",
      modes: [{ kind: "mode", id: "lab" }],
      command: { id: "glass-lab-artifacts.create", kind: "command" },
    });
    expect(extension.activityItems?.find((item) => item.id === "project-home")).toMatchObject({
      icon: "house",
      modes: [{ kind: "mode", id: "lab" }],
      placement: "last",
      command: { extensionId: "pstdio", id: "workbench.action.switchMode", kind: "command" },
      params: { modeId: "project" },
    });
    expect(extension.statusBarItems?.[0]).toMatchObject({
      when: { mode: { kind: "mode", id: "lab" } },
      view: { kind: "view", id: "status" },
    });
    expect(view("status")?.body).toMatchObject({ kind: "webview", entry: { path: "./src/views/lab-status-bar.tsx" } });
  });

  test("gives each main view an icon and a separate action menu", () => {
    expect(view("overview")).toMatchObject({
      icon: "layout-dashboard",
      body: { kind: "webview", entry: { path: "./src/views/lab-overview.tsx" } },
    });
    expect(view("artifacts")).toMatchObject({
      icon: "package-search",
      body: { kind: "dataTable" },
    });
    expect(view("cams")).toMatchObject({
      icon: "cctv",
      body: { kind: "webview", entry: { path: "./src/views/lab-cams.tsx" } },
    });
    expect(
      extension.viewMenus?.map((menu) => ({ id: menu.id, owner: menu.owner.id, view: menu.view.id, side: menu.side })),
    ).toEqual([
      { id: "artifacts.create", owner: "artifacts", view: "artifact-create", side: "right" },
      { id: "cams.cameras", owner: "cams", view: "camera-tree", side: "left" },
    ]);
    expect(view("camera-tree")?.body).toMatchObject({ kind: "tree", body: expect.any(Function) });
    expect(view("artifact-create")?.body).toMatchObject({
      kind: "controls",
      query: expect.any(Function),
      onValueChange: expect.any(Function),
    });
  });

  test("opens artifacts as a side inspector bound to the resource kind", () => {
    expect(view("artifact-detail")?.body).toMatchObject({
      kind: "webview",
      entry: { path: "./src/views/lab-artifact.tsx" },
    });
    // An attached resource adds an inspector; it never replaces the primary
    // location, so the kind declares no primary slot.
    expect(extension.resourceKinds?.find((kind) => kind.id === "glass-lab-artifact")).toMatchObject({
      surface: "attached",
      slots: [{ id: "inspector", cardinality: "many", access: "public" }],
    });
    expect(extension.resourceViews?.find((binding) => binding.id === "artifact-detail")).toMatchObject({
      slot: { id: "inspector" },
      view: { id: "artifact-detail" },
    });
    expect(extension.placements?.find((placement) => placement.id === "artifact-inspector.lab")).toMatchObject({
      item: { kind: "resource-slot", slot: { id: "inspector" } },
      region: "side",
    });
  });

  test("keeps the remaining lab surfaces", () => {
    const labPage = view("lab-page");
    expect(labPage?.body.kind === "webview" ? labPage.body.capabilities : undefined).toContain("notification.action");
    expect(extension.settings?.properties["counter.step"]).toMatchObject({
      type: "number",
      scope: "project",
      default: 1,
    });
    expect(extension.settings?.properties["greeting.tone"]).toMatchObject({
      type: "string",
      scope: "global",
      enum: ["friendly", "formal"],
    });
    expect(extension.settingsPanels?.find((panel) => panel.id === "project")).toMatchObject({
      view: { kind: "view", id: "project-settings" },
    });
    expect(extension.settingsPanels?.find((panel) => panel.id === "global")).toMatchObject({
      view: { kind: "view", id: "global-settings" },
    });
    expect(extension.settingsSections).toEqual([
      expect.objectContaining({ id: "lab", order: 30, title: expect.objectContaining({ default: "Lab" }) }),
    ]);
    expect(extension.settingsPanels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "project", section: { kind: "settings-section", id: "lab" } }),
        expect.objectContaining({ id: "global", section: { kind: "settings-section", id: "lab" } }),
      ]),
    );
    expect(extension.hooks).toEqual([]);
    expect(extension.templates?.find((template) => template.id === "labResource")).toMatchObject({
      title: expect.objectContaining({ default: "Glass Lab artifact" }),
      type: "glass-lab-artifact",
    });
    expect(extension.skills?.find((skill) => skill.id === "labResource")).toMatchObject({
      title: expect.objectContaining({ default: "Glass Lab Curator" }),
    });
    expect(extension.harnesses?.find((harness) => harness.id === "fake")).toMatchObject({
      id: "fake",
      label: expect.objectContaining({ default: "Fake Agent" }),
    });
    expect(extension.themes).toBeUndefined();
    expect(extension.fileIconThemes).toBeUndefined();
  });
});
