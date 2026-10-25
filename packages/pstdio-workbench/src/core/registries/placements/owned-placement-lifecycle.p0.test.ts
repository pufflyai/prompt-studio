import { expect, test } from "bun:test";
import {
  closeOwnedPlacementInstance,
  createOwnedPlacementState,
  openResourcePlacement,
} from "./owned-placement-lifecycle";
import { restoreOwnedPlacementState } from "./owned-placement-restoration";

const item = {
  kind: "binding" as const,
  binding: {
    kinds: [{ kind: "resource-kind" as const, id: "animation" }],
    view: { kind: "view" as const, id: "preview" },
    cardinality: "one" as const,
  },
};

test("a single-resource placement keeps its identity when opened with another resource", () => {
  const state = createOwnedPlacementState();
  const operation = {
    label: "Mode placement",
    id: "preview",
    item,
    state,
  };
  const first = openResourcePlacement({ ...operation, resource: { type: "animation", id: "first" } });
  const next = openResourcePlacement({ ...operation, resource: { type: "animation", id: "next" } });
  expect(next).toBe(first);
  expect(state.resourceInstances.get(operation.id)).toEqual([
    { instanceKey: first, resource: { type: "animation", id: "next" } },
  ]);
  expect(closeOwnedPlacementInstance({ ...operation, instanceKey: next })).toBe(true);
  expect(state.resourceInstances.get(operation.id)).toEqual([]);
});

test("a restored single-resource placement keeps its identity when another resource opens", () => {
  const state = restoreOwnedPlacementState({
    state: createOwnedPlacementState(),
    declarations: [{ id: "preview", item }],
    saved: [
      {
        widgetId: "preview",
        contributionId: "preview",
        placementIdentity: { kind: "mode", modeId: "project", placementId: "preview", instanceKey: "first" },
        resource: { type: "animation", id: "first" },
      },
    ],
    owns: (identity) => identity.kind === "mode" && identity.modeId === "project",
  });
  const first = state.resourceInstances.get("preview")![0]!.instanceKey;
  const next = openResourcePlacement({
    label: "Mode placement",
    id: "preview",
    item,
    state,
    resource: { type: "animation", id: "next" },
  });
  expect(next).toBe(first);
});
