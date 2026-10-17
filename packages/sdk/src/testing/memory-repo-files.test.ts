import { expect, test } from "bun:test";
import { createMemoryRepoFiles } from "./memory-repo-files";

test("matches file globs without crossing single-star directory boundaries", async () => {
  const mount = createMemoryRepoFiles();
  await mount.writeText(".folders/one/title.txt", "One");
  await mount.writeText(".folders/two/title.txt", "Two");
  await mount.writeText(".folders/one/nested/title.txt", "Nested");
  await mount.writeText(".folders/one/other.txt", "Other");
  expect((await mount.list(".folders/*/title.txt")).map(({ path }) => path)).toEqual([
    ".folders/one/title.txt",
    ".folders/two/title.txt",
  ]);
  expect(await mount.list("**/title.txt")).toHaveLength(3);
  expect(await mount.list(".folders/one/title.txt")).toEqual([
    { path: ".folders/one/title.txt", size: 3, updatedAt: expect.any(String) },
  ]);
});

test("lists immediate directories and updates metadata", async () => {
  const mount = createMemoryRepoFiles();
  await mount.writeText(".folders/one/title.txt", "One");
  await mount.writeText(".folders/one/nested/title.txt", "Nested");
  await mount.writeBytes(".folders/two/title.txt", new Uint8Array([1, 2]));
  expect(await mount.listDirs()).toEqual([".folders"]);
  expect(await mount.listDirs(".folders")).toEqual([".folders/one", ".folders/two"]);
  await mount.updateText(".folders/one/title.txt", "Longer");
  expect((await mount.list(".folders/one/title.txt"))[0]?.size).toBe(6);
});

test("direct fixture seeding keeps directory and metadata listings consistent", async () => {
  const mount = createMemoryRepoFiles();
  mount.files.set("folder/entry.txt", new TextEncoder().encode("Seed"));
  expect(await mount.exists("folder")).toBe(true);
  expect(await mount.listDirs()).toEqual(["folder"]);
  expect(await mount.list()).toEqual([{ path: "folder/entry.txt", size: 4, updatedAt: expect.any(String) }]);
  expect(Date.parse((await mount.list())[0]!.updatedAt!)).toBeGreaterThan(Date.now() - 60_000);
});
