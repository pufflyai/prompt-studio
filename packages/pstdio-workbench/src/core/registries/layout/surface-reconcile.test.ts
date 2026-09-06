import { describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceRef } from "../resources/resource-registry";
import { createLayoutModel } from "./layout-model";
import { registerTestWidget } from "./layout-model-test-utils";
import { getAnchorResource, reconcileAnchors } from "./surface-reconcile";

const ticket: ResourceRef = {
  type: "ticket",
  id: "pstdio://ticket/t1",
};
const inWorkspace: ResourceRef = {
  type: "session",
  id: "pstdio://session/s1",
};
// A scope predicate standing in for scoped candidate providers: a detached resource
// belongs to the new primary only when the test says so.
const scopeContaining =
  (...uris: string[]) =>
  (resource: ResourceRef) =>
    uris.includes(resourceKey(resource));
describe("reconcileAnchors", () => {
  test("clears a derived anchor (terminals) on primary change", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "terminals", title: "Terminals", region: "secondary" });
    layout.openWidget("terminals", {
      resource: {
        type: "terminal",
        id: "pstdio://terminal/x",
      },
    });
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(),
    });
    expect(actions).toContainEqual({ region: "secondary", action: "clear" });
  });
  test("keeps a Location-owned Sub Panel when its Location becomes active", () => {
    const layout = createLayoutModel();
    layout.registerPanel({ id: "ticket", title: "Ticket", region: "main", rendererId: "noop" });
    layout.registerPanel({
      id: "terminal",
      title: "Terminal",
      region: "secondary",
      rendererId: "noop",
      eligibleLocations: {},
    });
    layout.openWidget("ticket", { resource: ticket, role: "location" });
    layout.openWidget("terminal", {
      resource: {
        type: "terminal",
        id: "pstdio://terminal/x",
      },
      role: "sub-panel",
    });
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(),
    });
    expect(actions).toContainEqual({ region: "secondary", action: "keep" });
  });
  test("keeps a detached anchor (session) that is still in scope", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "session", title: "Session", region: "side" });
    layout.openWidget("session", { resource: inWorkspace });
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(resourceKey(inWorkspace)),
    });
    expect(actions).toContainEqual({ region: "side", action: "keep" });
  });
  test("disconnects a detached anchor when out of scope (scope wins)", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "session", title: "Session", region: "side" });
    layout.openWidget("session", { resource: inWorkspace });
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(),
    });
    expect(actions).toContainEqual({ region: "side", action: "clear" });
  });
  test("leaves a resourceless side widget untouched (not scoped content)", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "terminals", title: "Terminals", region: "secondary" });
    registerTestWidget(layout, { id: "panel", title: "Panel", region: "side" });
    // Opened without a resource — plain parked widgets, not scoped resources.
    layout.openWidget("terminals");
    layout.openWidget("panel");
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(),
    });
    expect(actions).toEqual([]);
  });
  test("never reconciles the primary anchor itself", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "board", title: "Board", region: "main" });
    layout.openWidget("board", { resource: ticket });
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(resourceKey(ticket)),
    });
    expect(actions.some((action) => action.region === "main")).toBe(false);
  });
  test("ignores anchors with no active placement", () => {
    const layout = createLayoutModel();
    const actions = reconcileAnchors({
      layout: layout.getLayout(),
      primary: ticket,
      isInScope: scopeContaining(),
    });
    expect(actions).toEqual([]);
  });
});
describe("getAnchorResource", () => {
  test("reads the primary resource from the main anchor, not the global signal", () => {
    const layout = createLayoutModel();
    registerTestWidget(layout, { id: "board", title: "Board", region: "main" });
    registerTestWidget(layout, { id: "session", title: "Session", region: "side" });
    layout.openWidget("board", { resource: ticket });
    // Activating a side anchor moves the global active widget, but primary must not follow.
    layout.openWidget("session", { resource: inWorkspace });
    expect(getAnchorResource(layout.getLayout(), "primary")).toEqual(ticket);
    expect(getAnchorResource(layout.getLayout(), "attached")).toEqual(inWorkspace);
  });
  test("is undefined when the anchor has no active placement", () => {
    const layout = createLayoutModel();
    expect(getAnchorResource(layout.getLayout(), "primary")).toBeUndefined();
  });
});
