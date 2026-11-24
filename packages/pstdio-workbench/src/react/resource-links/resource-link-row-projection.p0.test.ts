import { expect, test } from "bun:test";
import type { ResourceLinkChangePreview } from "./resource-links-types";
import { projectResourceLinkRows } from "./use-resource-link-rows";

const source = { id: "s", type: "ticket", projectId: "project", label: "Source ticket" };
const target = { id: "t", type: "note", projectId: "project", label: "Target note", role: "result" as const };
const change: ResourceLinkChangePreview = {
  id: Symbol("link"),
  status: "writing",
  change: { kind: "add", source, targets: [target] },
};

test("a pending new link appears on both endpoints without duplicating a read-back", () => {
  expect(projectResourceLinkRows([], [change], source)).toEqual([
    { edge: { source, target }, incoming: false, pending: "pending", candidate: { resource: target } },
  ]);
  expect(projectResourceLinkRows([], [change], target)).toEqual([
    { edge: { source, target }, incoming: true, pending: "pending", candidate: { resource: source } },
  ]);
  const confirmed = { edge: { source, target }, incoming: false, candidate: { resource: target } };
  expect(projectResourceLinkRows([confirmed], [change], source)).toEqual([confirmed]);
  expect(projectResourceLinkRows([], [change], { ...source, projectId: "other" })).toEqual([]);
});

test("only the newest directed intent is projected and the pending strip is bounded", () => {
  const removal: ResourceLinkChangePreview = {
    id: Symbol("remove"),
    status: "queued",
    change: { kind: "remove", source, targets: [target] },
  };
  expect(projectResourceLinkRows([], [change, removal], source)).toEqual([]);
  const bulk: ResourceLinkChangePreview = {
    ...change,
    status: "unknown",
    change: {
      kind: "add",
      source,
      targets: Array.from({ length: 30 }, (_, index) => ({ ...target, id: String(index) })),
    },
  };
  const rows = projectResourceLinkRows([], [bulk], source);
  expect(rows).toHaveLength(25);
  expect(rows.every((row) => row.pending === "unconfirmed")).toBe(true);
});
