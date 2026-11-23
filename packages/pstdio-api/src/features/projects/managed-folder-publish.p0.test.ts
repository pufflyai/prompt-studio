import { afterEach, expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectRejection } from "../../test-utils/expect-rejection";
import { publishManagedFolder } from "./managed-folder-publish";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "managed-publish-")));
  roots.push(root);
  await mkdir(join(root, "staging"));
  await writeFile(join(root, "staging", "owned"), "Retain the staged data");
  const { dev, ino } = await lstat(root, { bigint: true });
  return {
    root,
    publish: (to: string) =>
      publishManagedFolder({
        parent: root,
        identity: { dev, ino },
        from: "staging",
        to,
      }),
  };
};
test("exclusive publication preserves the staged directory and its contents", async () => {
  const { root, publish } = await fixture();
  await publish("published");
  expect(await readFile(join(root, "published", "owned"), "utf8")).toBe("Retain the staged data");
  await expectRejection(lstat(join(root, "staging"))).toMatchObject({ code: "ENOENT" });
});
test("exclusive publication retains a pre-existing empty directory and file", async () => {
  const { root, publish } = await fixture();
  await mkdir(join(root, "empty"));
  const before = await lstat(join(root, "empty"), { bigint: true });
  await writeFile(join(root, "file"), "Local data");
  await expectRejection(publish("empty")).toMatchObject({ code: "EEXIST" });
  await expectRejection(publish("file")).toMatchObject({ code: "EEXIST" });
  const after = await lstat(join(root, "empty"), { bigint: true });
  expect([after.dev, after.ino]).toEqual([before.dev, before.ino]);
  expect(await readFile(join(root, "file"), "utf8")).toBe("Local data");
  expect(await readFile(join(root, "staging", "owned"), "utf8")).toBe("Retain the staged data");
});
test("exclusive publication refuses a changed parent identity", async () => {
  const { root } = await fixture();
  const other = await lstat(tmpdir(), { bigint: true });
  await expectRejection(
    publishManagedFolder({
      parent: root,
      identity: { dev: other.dev, ino: other.ino },
      from: "staging",
      to: "published",
    }),
  ).toMatchObject({ code: "EXDEV" });
  expect(await readFile(join(root, "staging", "owned"), "utf8")).toBe("Retain the staged data");
});
test("exclusive publication rejects paths outside the held parent", async () => {
  const { publish } = await fixture();
  await expectRejection(publish("../outside")).toThrow("one directory entry");
  await expectRejection(publish("..\\outside")).toThrow("one directory entry");
});
