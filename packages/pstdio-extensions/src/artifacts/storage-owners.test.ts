import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveReadExtensionStoragePath } from "./storage-owners";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const owners = [{ name: "notes", extensionId: "alice.notes" }];

test("a legacy read path that leaves the project is not rewritten into it", async () => {
  const root = await mkdtemp(join(tmpdir(), "storage-owners-"));
  roots.push(root);
  await mkdir(join(root, ".pstdio/extension-storage/notes"), { recursive: true });
  const escaping = ".pstdio/extension-storage/notes/../../../../outside.txt";
  expect(await resolveReadExtensionStoragePath(root, escaping, owners)).toBe(escaping);
});

test("a legacy read path resolves to the existing name-only folder before migration", async () => {
  const root = await mkdtemp(join(tmpdir(), "storage-owners-"));
  roots.push(root);
  await mkdir(join(root, ".pstdio/extension-storage/notes"), { recursive: true });
  expect(await resolveReadExtensionStoragePath(`${root}/`, ".pstdio/extension-storage/notes/a.md", owners)).toBe(
    ".pstdio/extension-storage/notes/a.md",
  );
});
