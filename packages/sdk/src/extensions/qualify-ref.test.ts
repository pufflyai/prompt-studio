import { expect, test } from "bun:test";
import { defineCommand } from "./define-command";
import { definePage } from "./define-contribution";
import { qualifyRef } from "./qualify-ref";

test("qualifies provider refs and nested panels without changing local definitions", () => {
  const page = definePage({
    id: "notes",
    title: "Notes",
    path: "notes",
    mode: { kind: "mode", id: "review" },
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "inspector",
        region: "side",
        item: { kind: "view", view: { kind: "view", id: "inspector" }, presence: "closed" },
      },
    ],
  });
  expect(qualifyRef("acme.notes", page.ref)).toEqual({ kind: "page", id: "notes", extensionId: "acme.notes" });
  expect(qualifyRef("acme.notes", page.panels.inspector)).toEqual({
    kind: "page-slot",
    id: "inspector",
    page: { kind: "page", id: "notes", extensionId: "acme.notes" },
  });
  expect(page.ref).toEqual({ kind: "page", id: "notes" });
  expect(page.panels.inspector.page).toEqual(page.ref);
});

test("qualifies command refs without copying command implementations", () => {
  const command = defineCommand({ id: "save", title: "Save", run: () => ({ saved: true }) });
  expect(qualifyRef("acme.notes", command.ref)).toEqual({ kind: "command", id: "save", extensionId: "acme.notes" });
});
