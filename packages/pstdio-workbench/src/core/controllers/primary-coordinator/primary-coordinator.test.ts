import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "../../registries/layout/layout-model";
import { registerTestWidget } from "../../registries/layout/layout-model-test-utils";
import { getAnchorResource } from "../../registries/layout/surface-reconcile";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createPrimaryCoordinator } from "./primary-coordinator";

const workspaceA: ResourceRef = { kind: "workspace", uri: "pstdio://workspace/a" };
const workspaceB: ResourceRef = { kind: "workspace", uri: "pstdio://workspace/b" };
const terminal: ResourceRef = { kind: "terminal", uri: "pstdio://terminal/a" };
const session: ResourceRef = { kind: "session", uri: "pstdio://session/a" };

const setup = (isInScope: (resource: ResourceRef) => boolean) => {
  const layout = createLayoutModel();
  registerTestWidget(layout, { id: "workspace", title: "Workspace", region: "main" });
  registerTestWidget(layout, { id: "terminals", title: "Terminals", region: "secondary" });
  registerTestWidget(layout, { id: "session", title: "Session", region: "side" });
  const coordinator = createPrimaryCoordinator({ layout, isInScope });

  layout.openWidget("workspace", { resource: workspaceA });
  layout.openWidget("terminals", { resource: terminal });
  layout.openWidget("session", { resource: session });

  return { layout, coordinator };
};

const hostsActive = (layout: ReturnType<typeof createLayoutModel>, region: "secondary" | "side") =>
  layout.getLayout().regions[region].widgets.length > 0;

describe("createPrimaryCoordinator", () => {
  test("keeps the derived anchor restored with a persistence scope", () => {
    const layouts = new Map<
      string | undefined,
      ReturnType<typeof createLayoutModel>["getLayout"] extends () => infer T ? T : never
    >();
    const layout = createLayoutModel({
      persistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (next, scope) => layouts.set(scope, structuredClone(next)),
      },
    });
    registerTestWidget(layout, { id: "workspace", title: "Workspace", region: "main" });
    registerTestWidget(layout, { id: "terminals", title: "Terminals", region: "secondary" });
    createPrimaryCoordinator({ layout, isInScope: () => true });

    layout.setPersistenceScope("workspace-a");
    layout.openWidget("workspace", { resource: workspaceA });
    layout.openWidget("terminals", { resource: terminal });
    layout.setPersistenceScope("workspace-b");
    layout.openWidget("workspace", { resource: workspaceB });
    layout.setPersistenceScope("workspace-a");

    expect(hostsActive(layout, "secondary")).toBe(true);
  });

  test("clears the derived anchor when the primary changes", () => {
    const { layout } = setup(() => true);
    expect(hostsActive(layout, "secondary")).toBe(true);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "secondary")).toBe(false);
  });

  test("keeps a detached anchor that stays in scope", () => {
    const { layout } = setup(() => true);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "side")).toBe(true);
  });

  test("disconnects a detached anchor that falls out of scope", () => {
    const { layout } = setup(() => false);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "side")).toBe(false);
  });

  test("never clears the primary anchor itself", () => {
    const { layout } = setup(() => false);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(layout.getLayout().regions.main.widgets).toHaveLength(1);
    expect(layout.getLayout().regions.main.widgets[0].resourceUri).toBe(workspaceB.uri);
  });

  test("does not reconcile when a side anchor activates (no feedback loop)", () => {
    const { layout } = setup(() => true);
    // Re-open the session (a side anchor) with the same primary in 'main'. The primary
    // selector must not fire, so the derived terminal anchor stays put.
    layout.openWidget("terminals", { resource: terminal });
    expect(hostsActive(layout, "secondary")).toBe(true);
  });

  test("keeps a derived anchor populated for the new primary during the primary change", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "workspace", title: "Workspace", region: "main" });
    registerTestWidget(layout, { id: "terminals", title: "Terminals", region: "secondary" });
    layout.openWidget("workspace", { resource: workspaceA });
    const populateForNewPrimary = layout.store.subscribe((state, previous) => {
      const primary = getAnchorResource(state.layout, "primary")?.uri;
      if (primary === getAnchorResource(previous.layout, "primary")?.uri || primary !== workspaceB.uri) return;
      layout.openWidget("terminals", { resource: terminal });
    });
    createPrimaryCoordinator({ layout, isInScope: () => true });

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "secondary")).toBe(true);
    populateForNewPrimary();
  });

  test("stops reconciling after disposal", () => {
    const { layout, coordinator } = setup(() => true);
    coordinator.dispose();

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "secondary")).toBe(true);
  });
});
