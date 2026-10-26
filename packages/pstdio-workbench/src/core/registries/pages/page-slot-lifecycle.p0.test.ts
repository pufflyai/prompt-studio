import { expect, test } from "bun:test";
import { pageFollowerIdentities } from "./page-placement-resolver";
import type { WorkbenchPageContribution } from "./page-registry-types";
import { closePageSlot, emptyPageState, openResourceSlot } from "./page-slot-lifecycle";

const slot = {
  id: "preview",
  role: "auxiliary" as const,
  region: "side" as const,
  openOn: "page-resource" as const,
  item: {
    kind: "binding" as const,
    binding: {
      kinds: [{ kind: "resource-kind" as const, id: "animation" }],
      view: { kind: "view" as const, id: "preview" },
      cardinality: "one" as const,
    },
  },
};
const page: WorkbenchPageContribution = {
  id: "animation",
  ref: { kind: "page", extensionId: "lab", id: "animation" },
  path: "animation",
  modeId: "project",
  main: { kind: "view", view: { kind: "view", id: "preview" }, cardinality: "one" },
  slots: [slot],
};
const resourceKey = (resource: { id: string }) => resource.id;

test("a single-resource slot rebinds its resource without replacing its placement", () => {
  const first = openResourceSlot({
    slot,
    state: emptyPageState(page),
    target: { pageId: page.id, resource: { type: "animation", id: "first" } },
    resourceKey,
  });
  const next = openResourceSlot({
    slot,
    state: first,
    target: { pageId: page.id, resource: { type: "animation", id: "next" } },
    resourceKey,
  });
  expect(next.resourceInstances.preview).toHaveLength(1);
  expect(next.resourceInstances.preview[0].resource.id).toBe("next");
  expect(next.resourceInstances.preview[0].instanceKey).toBe(first.resourceInstances.preview[0].instanceKey);
  expect(pageFollowerIdentities(page, { type: "animation", id: "next" }, resourceKey)[0]?.instanceKey).toBe(
    next.resourceInstances.preview[0].instanceKey,
  );
  const closed = closePageSlot({ page, slot, state: next, instanceKey: next.resourceInstances.preview[0].instanceKey });
  expect(closed.state.resourceInstances.preview).toEqual([]);
});
