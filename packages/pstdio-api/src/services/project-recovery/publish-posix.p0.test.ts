import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRecoveryStaging } from "./publish-posix";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "recovery-publish-")));
  roots.push(root);
  await mkdir(join(root, "staging"));
  await writeFile(join(root, "staging", "file"), "restored");
  const { dev, ino } = await stat(root, { bigint: true });
  return {
    root,
    publish: (to: string) => publishRecoveryStaging({ parent: root, identity: { dev, ino }, from: "staging", to }),
  };
};

test("publication moves a staged folder only into an absent destination", async () => {
  const { root, publish } = await fixture();
  await publish("restored");
  expect(await readFile(join(root, "restored", "file"), "utf8")).toBe("restored");
  expect(await readdir(root)).toEqual(["restored"]);
});

test("publication never replaces an existing destination, even an empty folder or a file", async () => {
  const { root, publish } = await fixture();
  await mkdir(join(root, "empty"));
  await writeFile(join(root, "file"), "local work");
  await expect(publish("empty")).rejects.toMatchObject({ code: "EEXIST" });
  await expect(publish("file")).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readdir(join(root, "empty"))).toEqual([]);
  expect(await readFile(join(root, "file"), "utf8")).toBe("local work");
  expect(await readFile(join(root, "staging", "file"), "utf8")).toBe("restored");
});

test("publication refuses a parent folder that was replaced after it was checked", async () => {
  const { root } = await fixture();
  const other = await stat(tmpdir(), { bigint: true });
  await expect(
    publishRecoveryStaging({ parent: root, identity: { dev: other.dev, ino: other.ino }, from: "staging", to: "x" }),
  ).rejects.toThrow("moved");
  expect((await readdir(root)).sort()).toEqual(["staging"]);
});
