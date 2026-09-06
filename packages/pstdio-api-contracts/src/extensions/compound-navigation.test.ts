import { expect, test } from "bun:test";
import { navigationTargetSchema } from "./navigation-target-metadata";

const page = { kind: "page", page: { extensionId: "example.notes", kind: "page", id: "notes" } };
const panel = { kind: "panel", panel: { extensionId: "example.notes", kind: "placement", id: "inspector" } };

test("compound navigation accepts page and panel operations", () => {
  expect(navigationTargetSchema.safeParse({ kind: "compound", targets: [page, panel] }).success).toBe(true);
});
test("commands and links remain standalone actions", () => {
  for (const target of [
    { kind: "href", href: "https://example.com" },
    { kind: "command", target: { command: { extensionId: "example.notes", kind: "command", id: "save" } } },
  ]) {
    expect(navigationTargetSchema.safeParse(target).success).toBe(true);
    expect(navigationTargetSchema.safeParse({ kind: "compound", targets: [page, target] }).success).toBe(false);
  }
});
