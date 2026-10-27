import { afterEach, expect, test } from "bun:test";
import { createExtensionStorageDBService } from "./extension-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async () => {
  const f = await createExtensionStorageFixture();
  cleanup.push(f.close);
  return { ...f, projections: f.svc.fileProjections };
};
const entry = (path: string, revision: string) => ({
  node: { path, parent: "root", kind: "file" as const, updatedAt: "2026-01-01T00:00:00.000Z" },
  hash: revision,
  revision,
});

test("point and full reconciliation share persisted path projection facts", async () => {
  const f = await fixture();
  const projection = f.projections.open("owner-root");
  expect(await projection.read(["notes/one.md"])).toEqual({ initialized: false, state: {} });
  await projection.write({
    "notes/one.md": entry("notes/one.md", "first"),
    "notes/two.md": entry("notes/two.md", "second"),
  });
  await projection.write({ "notes/one.md": entry("notes/one.md", "updated") });
  const reopened = createExtensionStorageDBService(f.db).fileProjections.open("owner-root");
  expect(await reopened.read(["notes/one.md"])).toEqual({
    initialized: true,
    state: { "notes/one.md": entry("notes/one.md", "updated") },
  });
  expect(await reopened.read()).toEqual({
    initialized: true,
    state: {
      "notes/one.md": entry("notes/one.md", "updated"),
      "notes/two.md": entry("notes/two.md", "second"),
    },
  });
  expect(await f.projections.open("another-root").read()).toEqual({ initialized: false, state: {} });
});

test("an existing indexed root wins when a legacy import is retried after interrupted cleanup", async () => {
  const f = await fixture();
  const projection = f.projections.open("owner-root");
  expect(await projection.initialize({ "notes/one.md": entry("notes/one.md", "old") })).toBe(true);
  await projection.write({ "notes/one.md": entry("notes/one.md", "new") });
  expect(await projection.initialize({ "notes/one.md": entry("notes/one.md", "old") })).toBe(false);
  expect((await projection.read()).state).toEqual({ "notes/one.md": entry("notes/one.md", "new") });
});
