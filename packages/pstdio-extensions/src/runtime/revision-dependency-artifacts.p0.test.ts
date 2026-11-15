import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { collectRevisionDependencies } from "./revision-dependencies";
import { copyRevisionDependencies } from "./revision-dependency-artifacts";
import { revisionSnapshotLocation, revisionSnapshotPath } from "./revision-snapshot-path";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

for (const conflict of [false, true]) {
  test(
    conflict
      ? "conflicting physical dependency bindings reject preparation"
      : "ancestor alias bindings share the same frozen dependency",
    () => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "revision-physical-bindings-")));
      roots.push(root);
      const source = join(root, "source");
      const outer = join(root, "store", "outer");
      const shared = join(root, "store", "shared");
      const other = join(root, "store", "other");
      const generation = join(root, "generation");
      const packages = new Map() as ReturnType<typeof collectRevisionDependencies>;
      packages.contents = new Map();
      packages.compilerInputs = new Map();
      for (const path of [source, outer, shared, other]) {
        mkdirSync(path, { recursive: true });
        writeFileSync(join(path, "index.js"), path === shared ? "accepted bytes" : "other bytes");
        packages.set(path, {
          path,
          files: new Set(["index.js"]),
          allFiles: false,
          dependencies: new Map(),
          moduleInputs: new Map(),
          bindings: new Map(),
        });
      }
      packages.get(source)!.bindings.set(join(source, "node_modules", "outer"), outer);
      packages.get(outer)!.bindings.set(join(outer, "node_modules", "shared"), shared);
      packages
        .get(outer)!
        .bindings.set(join(source, "node_modules", "outer", "node_modules", "shared"), conflict ? other : shared);
      const copy = () =>
        copyRevisionDependencies(packages, source, revisionSnapshotPath(generation, source), generation);
      if (conflict) {
        expect(copy).toThrow();
        return;
      }
      copy();
      const aliased = revisionSnapshotLocation(
        generation,
        join(source, "node_modules", "outer", "node_modules", "shared", "index.js"),
      );
      writeFileSync(join(shared, "index.js"), "mutable edit");
      expect(readFileSync(aliased, "utf8")).toBe("accepted bytes");
    },
  );
}
