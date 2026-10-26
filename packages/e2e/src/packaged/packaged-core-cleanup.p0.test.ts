import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeCoreFixture } from "./packaged-core-cleanup";

const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-core-cleanup-"));
  roots.push(root);
  return root;
};
afterEach(async () => {
  for (const root of roots.splice(0)) await removeCoreFixture(root);
});

test("removes nested owned files while preserving external dependency targets", async () => {
  const root = fixture();
  const external = join(root, "external");
  const owned = join(root, "owned");
  const nested = join(owned, "cache", "snapshot", "package");
  mkdirSync(external);
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(external, "keep.txt"), "External dependency");
  writeFileSync(join(nested, "entry.ts"), "export default {};");
  linkSync(join(external, "keep.txt"), join(nested, "hard-link.txt"));
  symlinkSync(external, join(nested, "dependency"), "junction");
  const missing = join(root, "missing");
  mkdirSync(missing);
  symlinkSync(missing, join(nested, "broken-dependency"), "junction");
  rmSync(missing, { recursive: true });

  await removeCoreFixture(owned);

  expect(existsSync(owned)).toBe(false);
  expect(readFileSync(join(external, "keep.txt"), "utf8")).toBe("External dependency");
});

test("removes a linked root without entering its target and tolerates missing roots", async () => {
  const root = fixture();
  const external = join(root, "external");
  const owned = join(root, "owned");
  mkdirSync(external);
  writeFileSync(join(external, "keep.txt"), "External dependency");
  symlinkSync(external, owned, "junction");

  await removeCoreFixture(owned);
  await removeCoreFixture(owned);

  expect(existsSync(owned)).toBe(false);
  expect(readFileSync(join(external, "keep.txt"), "utf8")).toBe("External dependency");
});

test("removes every branch before its parent across a large nested tree", async () => {
  const root = fixture();
  const owned = join(root, "owned");
  for (let branch = 0; branch < 100; branch++) {
    const directory = join(owned, `branch-${branch}`, "nested", "package");
    mkdirSync(directory, { recursive: true });
    for (let file = 0; file < 10; file++) writeFileSync(join(directory, `entry-${file}.ts`), "export {};");
  }

  await removeCoreFixture(owned);

  expect(existsSync(owned)).toBe(false);
});
