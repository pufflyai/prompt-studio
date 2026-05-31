import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "../../registries/layout/layout-model";
import { registerTestWidget } from "../../registries/layout/layout-model-test-utils";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createPrimaryCoordinator } from "./primary-coordinator";

const workspaceA: ResourceRef = { kind: "workspace", uri: "pstdio://workspace/a" };
const workspaceB: ResourceRef = { kind: "workspace", uri: "pstdio://workspace/b" };
const terminal: ResourceRef = { kind: "terminal", uri: "pstdio://terminal/a" };
const session: ResourceRef = { kind: "session", uri: "pstdio://session/a" };

const setup = (isInScope: (resource: ResourceRef) => boolean) => {
  const layout = createLayoutModel();
  registerTestWidget(layout, { id: "workspace", title: "Workspace", area: "main" });
  registerTestWidget(layout, { id: "terminals", title: "Terminals", area: "secondary" });
  registerTestWidget(layout, { id: "session", title: "Session", area: "floating" });
  const coordinator = createPrimaryCoordinator({ layout, isInScope });

  layout.openWidget("workspace", { resource: workspaceA });
  layout.openWidget("terminals", { resource: terminal });
  layout.openWidget("session", { resource: session });

  return { layout, coordinator };
};

const hostsActive = (layout: ReturnType<typeof createLayoutModel>, area: "secondary" | "floating") =>
  layout.getLayout().areas[area].widgets.length > 0;

describe("createPrimaryCoordinator", () => {
  test("clears the derived anchor when the primary changes", () => {
    const { layout } = setup(() => true);
    expect(hostsActive(layout, "secondary")).toBe(true);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "secondary")).toBe(false);
  });

  test("keeps a detached anchor that stays in scope", () => {
    const { layout } = setup(() => true);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "floating")).toBe(true);
  });

  test("disconnects a detached anchor that falls out of scope", () => {
    const { layout } = setup(() => false);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "floating")).toBe(false);
  });

  test("never clears the primary anchor itself", () => {
    const { layout } = setup(() => false);

    layout.openWidget("workspace", { resource: workspaceB });

    expect(layout.getLayout().areas.main.widgets).toHaveLength(1);
    expect(layout.getLayout().areas.main.widgets[0].resourceUri).toBe(workspaceB.uri);
  });

  test("does not reconcile when a side anchor activates (no feedback loop)", () => {
    const { layout } = setup(() => true);
    // Re-open the session (a side anchor) with the same primary in 'main'. The primary
    // selector must not fire, so the derived terminal anchor stays put.
    layout.openWidget("terminals", { resource: terminal });
    expect(hostsActive(layout, "secondary")).toBe(true);
  });

  test("stops reconciling after disposal", () => {
    const { layout, coordinator } = setup(() => true);
    coordinator.dispose();

    layout.openWidget("workspace", { resource: workspaceB });

    expect(hostsActive(layout, "secondary")).toBe(true);
  });
});
