import { expect, test } from "bun:test";
import { getNavigationTargetKey } from "./navigation-target-key";

test("matches command parameters regardless of property order and empty parameters", () => {
  expect(getNavigationTargetKey({ kind: "command", commandId: "open", args: { b: 2, a: 1 } })).toBe(
    getNavigationTargetKey({ kind: "command", commandId: "open", args: { a: 1, b: 2 } }),
  );
  expect(getNavigationTargetKey({ kind: "command", commandId: "open", args: {} })).toBe(
    getNavigationTargetKey({ kind: "command", commandId: "open" }),
  );
  expect(getNavigationTargetKey({ kind: "command", commandId: "open", args: { a: 1 } })).not.toBe(
    getNavigationTargetKey({ kind: "command", commandId: "open", args: { a: 2 } }),
  );
});

test("keeps navigation resources and compound destination order distinct", () => {
  const page = { kind: "page" as const, page: { kind: "page" as const, id: "notes", extensionId: "tools.notes" } };
  const panel = { kind: "panel" as const, panel: { kind: "placement" as const, id: "inspector" } };
  expect(getNavigationTargetKey(page)).not.toBe(
    getNavigationTargetKey({ ...page, resource: { type: "note", id: "1" } }),
  );
  expect(getNavigationTargetKey({ kind: "compound", targets: [page, panel] })).not.toBe(
    getNavigationTargetKey({ kind: "compound", targets: [panel, page] }),
  );
});
