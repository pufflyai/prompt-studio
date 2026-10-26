import { expect, test } from "bun:test";
import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import { buildExtensionCommandTable } from "./extension-cli-router";

const command = (publisher: string): ExtensionCommandRecord => ({
  id: `${publisher}.notes.command.list`,
  extensionId: `${publisher}.notes`,
  title: "List notes",
  cliPath: `${publisher}.notes list`,
  cliAliases: [`${publisher}-notes`],
});
test("routes identical names by full ID and rejects an ambiguous deprecated name", () => {
  const alice = command("alice");
  const bob = command("bob");
  const table = buildExtensionCommandTable([alice, bob]);
  expect(table.byPath.get("alice.notes list")).toBe(alice);
  expect(table.byPath.get("bob.notes list")).toBe(bob);
  expect(table.byPath.get("notes list")).toBeUndefined();
  expect(table.collisions).toContainEqual({ path: "notes list", commands: [alice, bob] });
  expect(table.byPath.get("alice-notes")).toBe(alice);
});
test("keeps an unambiguous deprecated namespace available", () => {
  const alice = command("alice");
  expect(buildExtensionCommandTable([alice]).byPath.get("notes list")).toBe(alice);
});

test("rejects a deprecated namespace when its publishers expose different commands", () => {
  const alice = command("alice");
  const bob = { ...command("bob"), cliPath: "bob.notes create" };
  const table = buildExtensionCommandTable([alice, bob]);
  expect(table.byPath.get("notes list")).toBeUndefined();
  expect(table.collisions.find((collision) => collision.path === "notes list")?.commands).toEqual([alice, bob]);
});

test("rejects a deprecated namespace when another publisher has no commands", () => {
  const alice = command("alice");
  const table = buildExtensionCommandTable([alice], ["alice.notes", "bob.notes"]);
  expect(table.byPath.get("alice.notes list")).toBe(alice);
  expect(table.byPath.get("notes list")).toBeUndefined();
  expect(table.collisions.some((collision) => collision.path === "notes list")).toBe(true);
});
