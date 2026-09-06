import { expect, test } from "bun:test";
import { definePage, defineView } from "./define-contribution";

test("generates panel refs from additional slots independently of Main content", () => {
  const view = defineView({ id: "notes", title: "Notes", body: { kind: "tree", body: async () => [] } });
  const page = definePage({
    id: "notes",
    title: "Notes",
    path: "notes",
    mode: { kind: "mode", id: "project" },
    main: { kind: "view", view: view.ref, cardinality: "one" },
    slots: [{ id: "inspector", region: "side", item: { kind: "view", view: view.ref, presence: "closed" } }],
  });
  expect(page.panels.inspector).toEqual({ kind: "page-slot", page: page.ref, id: "inspector" });
});
