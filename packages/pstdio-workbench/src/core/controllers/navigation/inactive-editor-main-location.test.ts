import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { harness, navigate, page, resource } from "../composition/placement-lifecycle-test-support";
import { findOpenResourceEditor } from "./resource-editor-resolver";

const modePanel = { kind: "placement" as const, extensionId: "test", id: "inspector-mode" };
const toolPanel = { kind: "placement" as const, extensionId: "test", id: "tool" };
const binding = {
  kind: "binding" as const,
  binding: {
    kinds: [{ kind: "resource-kind" as const, id: "file" }],
    view: { kind: "view" as const, id: "inspector" },
    cardinality: "many" as const,
  },
};
const setup = (saved: Map<string | undefined, WorkbenchLayout>) => {
  const w = harness(saved);
  w.views.registerView({
    id: "inspector",
    title: "Inspector",
    instancePolicy: "per-resource",
    body: { kind: "react", render: () => null },
  });
  w.modePlacements.registerPlacement({
    id: "inspector-mode",
    ref: modePanel,
    modeId: "edit",
    region: "side",
    item: binding,
  });
  w.shellPlacements.registerPlacement({ id: "inspector-shell", region: "secondary", item: binding });
  w.modePlacements.registerPlacement({
    id: "tool",
    ref: toolPanel,
    modeId: "edit",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "empty" }, presence: "closed" },
  });
  w.pages.registerPage({
    id: "documents",
    ref: page("documents"),
    modeId: "edit",
    path: "documents",
    parentId: "workspace",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [{ id: "inspector-page", region: "bottom", item: binding }],
  });
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "review",
    ref: page("review"),
    modeId: "review",
    path: "review",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
  return w;
};
for (const owner of ["page", "mode", "shell"] as const)
  for (const tool of [false, true])
    for (const heading of [false, true])
      for (const reload of [false, true]) {
        test(`${owner} editor restores its document owner with ${tool ? "a tool" : "a document"} selected, ${heading ? "heading" : "line"} address, and ${reload ? "reloaded" : "live"} cache`, async () => {
          const saved = new Map<string | undefined, WorkbenchLayout>();
          let w = setup(saved);
          const position = heading ? undefined : { line: 10, column: 2 };
          const section = heading ? { anchors: [{ id: "intro", heading: "Intro" }] } : undefined;
          const targets = {
            page: {
              kind: "panel",
              panel: { kind: "page-slot", page: page("documents"), id: "inspector-page" },
              resource: resource("b"),
              open: "pin",
            },
            mode: { kind: "panel", panel: modePanel, resource: resource("b"), open: "pin" },
            shell: {
              kind: "panel",
              panel: { kind: "shell-placement", id: "inspector-shell" },
              resource: resource("b"),
              open: "pin",
            },
          } as const;
          const target = targets[owner];
          await w.navigation.openTarget({
            kind: "page",
            page: page("documents"),
            resource: { ...resource("a"), metadata: { path: "a.ts" } },
            position,
            section,
            parent: navigate("alpha"),
            open: "pin",
          });
          if (tool) {
            await w.navigation.openTarget({ kind: "panel", panel: toolPanel });
            w.movePanel(w.layout.getLayout().activeWidgetId!, "main");
          }
          await w.navigation.openTarget(target);
          const editorId = w.layout.getLayout().activeWidgetId;
          const mainId = w.layout.getLayout().activeLocationWidgetId;
          await w.navigation.openTarget({ kind: "page", page: page("review") });
          if (reload) {
            w = setup(saved);
            await w.navigation.openTarget({ kind: "page", page: page("review") });
          }
          expect(findOpenResourceEditor(w, "inspector", resource("b"))?.tab.widgetId).toBe(editorId);
          await w.navigation.openTarget(target);
          expect(w.layout.getLayout().activeWidgetId).toBe(editorId);
          expect(w.pages.store.getState().location?.resource?.id).toBe("a");
          expect(w.pages.store.getState().location?.position).toEqual(position);
          expect(w.pages.store.getState().location?.section).toEqual(section);
          expect(w.layout.getLayout().regions.main.widgets.find((t) => t.widgetId === mainId)?.section).toEqual(
            section,
          );
          expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
          expect(w.layout.getLayout().activeLocationWidgetId).toBe(mainId);
          expect(w.layout.getLayout().regions.main.widgets.find((t) => t.widgetId === mainId)?.position).toEqual(
            position,
          );
          const regions = { page: "bottom", mode: "side", shell: "secondary" } as const;
          expect(w.focus.getActiveRegion()).toBe(regions[owner]);
        });
      }
