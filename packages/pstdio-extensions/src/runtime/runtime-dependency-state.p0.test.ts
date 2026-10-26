import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeDependencyState } from "./runtime-dependency-state";

const roots: string[] = [];
const fixture = (manifest: Record<string, unknown>) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-dependency-state-"));
  roots.push(root);
  const modules = join(root, "node_modules");
  mkdirSync(modules);
  writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
  return { root, modules, state: () => runtimeDependencyState(root, new Set(), modules) };
};
const writeManifest = (path: string, manifest: Record<string, unknown>) => {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test.each([
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
])("installing a missing %s package changes the runtime dependency state", (field) => {
  const { modules, state } = fixture({ [field]: { library: "*" } });
  const missing = state();
  writeManifest(join(modules, "library"), { name: "library", version: "1.0.0" });
  expect(state()).not.toBe(missing);
});

test("development and unrelated installed packages preserve runtime dependency state", () => {
  const { modules, state } = fixture({ devDependencies: { dev: "*" } });
  const before = state();
  writeManifest(join(modules, "dev"), { name: "dev", version: "1.0.0" });
  writeManifest(join(modules, "unrelated"), { name: "unrelated", version: "1.0.0" });
  expect(state()).toBe(before);
});

test("nested dependency updates are observed through a cyclic package graph", () => {
  const { modules, state } = fixture({ dependencies: { library: "*" } });
  const library = join(modules, "library");
  const leaf = join(library, "node_modules", "leaf");
  writeManifest(library, { name: "library", dependencies: { leaf: "*" } });
  writeManifest(leaf, { name: "leaf", version: "1.0.0", dependencies: { library: "*" } });
  const original = state();
  expect(state()).toBe(original);
  writeManifest(leaf, { name: "leaf", version: "2.0.0", dependencies: { library: "*" } });
  expect(state()).not.toBe(original);
});

test("retargeting a linked dependency changes runtime identity even with the same manifest", () => {
  const { root, modules, state } = fixture({ dependencies: { library: "*" } });
  const first = join(root, "first");
  const second = join(root, "second");
  const linked = join(modules, "library");
  for (const path of [first, second]) writeManifest(path, { name: "library", version: "1.0.0" });
  symlinkSync(first, linked, "junction");
  const original = state();
  rmSync(linked);
  symlinkSync(second, linked, "junction");
  expect(state()).not.toBe(original);
});
