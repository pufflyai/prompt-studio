import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { refreshPageResources } from "./page-resource-refresh";

test("refresh replaces resource data without changing page selection or placement identities", () => {
  const resource = { type: "note", id: "b", label: "Old", metadata: { documentId: "body" } };
  const states = {
    notes: {
      openStaticSlotIds: [],
      activePrimaryInstanceKey: "a",
      resourceInstances: { editor: [{ instanceKey: "b-key", resource }] },
    },
  };
  const next = refreshPageResources(states, { ...resource, label: "New", metadata: { writable: false } }, resourceKey);
  expect(next.notes?.activePrimaryInstanceKey).toBe("a");
  expect(next.notes?.resourceInstances.editor?.[0]).toMatchObject({
    instanceKey: "b-key",
    resource: { label: "New", metadata: { writable: false, documentId: "body" } },
  });
});
