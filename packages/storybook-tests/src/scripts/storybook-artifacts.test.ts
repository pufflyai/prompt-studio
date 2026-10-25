import { afterEach, expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packStorybook, restoreStorybooks } from "./storybook-artifacts";
import { sharedStorybooks } from "./storybook-config";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "storybook-artifacts-"));
  directories.push(root);
  const artifacts = join(root, "artifacts");
  for (const { packageName } of sharedStorybooks) {
    const output = join(root, "packages", packageName, "storybook-static");
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "index.json"), JSON.stringify({ owner: packageName }));
    await writeFile(join(output, "iframe.html"), `<main>${packageName}</main>`);
    await packStorybook(root, artifacts, packageName);
  }
  await rm(join(root, "packages"), { recursive: true });
  return { root, artifacts };
};

test("independent producer archives restore all owners at their original paths", async () => {
  const { root, artifacts } = await fixture();
  await restoreStorybooks(root, artifacts);
  for (const { packageName } of sharedStorybooks) {
    const index = await readFile(join(root, "packages", packageName, "storybook-static/index.json"), "utf8");
    expect(JSON.parse(index).owner).toBe(packageName);
  }
});

test("a missing owner archive blocks restoration before accepting partial output", async () => {
  const { root, artifacts } = await fixture();
  await rm(join(artifacts, "storybook-pstdio-dashboard.tar.gz"));
  await expect(restoreStorybooks(root, artifacts)).rejects.toThrow();
  expect(await Bun.file(join(root, "packages/ui/storybook-static/index.json")).exists()).toBe(false);
});

test("an archive from another owner cannot replace a missing producer", async () => {
  const { root, artifacts } = await fixture();
  await copyFile(join(artifacts, "storybook-ui.tar.gz"), join(artifacts, "storybook-pstdio-dashboard.tar.gz"));
  await expect(restoreStorybooks(root, artifacts)).rejects.toThrow("owner");
  expect(await Bun.file(join(root, "packages/ui/storybook-static/index.json")).exists()).toBe(false);
});
