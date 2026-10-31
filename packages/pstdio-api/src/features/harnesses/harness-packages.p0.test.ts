import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionInstallations } from "../../services/extension-installations";
import { createHarnessPackages } from "./harness-packages";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const owner = { extensionId: "example.harness", name: "harness", displayName: "Harness" };
const request = { name: "example-cli", version: "1.2.3" };
const cache = async () => {
  const root = await mkdtemp(join(tmpdir(), "harness-package-"));
  roots.push(root);
  return root;
};

test("reuses a pinned cached package without starting installation work", async () => {
  const root = await cache();
  const packagePath = join(root, owner.extensionId, "example-cli@1.2.3", "node_modules", request.name);
  await mkdir(packagePath, { recursive: true });
  await writeFile(join(packagePath, "package.json"), JSON.stringify(request));
  const jobs = createExtensionInstallations();
  const packages = createHarnessPackages({ cacheRoot: root, installations: jobs });
  expect(await packages.forHarness(owner).ensure(request)).toEqual({ path: packagePath });
  expect(jobs.list()).toEqual([]);
});

test("shares acquisition, keeps a failed download retryable, and publishes only the completed cache", async () => {
  const root = await cache();
  const jobs = createExtensionInstallations();
  let calls = 0;
  const packages = createHarnessPackages({
    cacheRoot: root,
    installations: jobs,
    run: async (_command, args, options) => {
      expect(args).toEqual(["install", "--production", "--ignore-scripts"]);
      expect(JSON.parse(await readFile(join(options.cwd, "package.json"), "utf8")).dependencies).toEqual({
        "example-cli": "1.2.3",
      });
      if (++calls === 1) return { exitCode: 1, stdout: "", stderr: "Download failed" };
      const packagePath = join(options.cwd, "node_modules", request.name);
      await mkdir(packagePath, { recursive: true });
      await writeFile(join(packagePath, "package.json"), JSON.stringify(request));
      return { exitCode: 0, stdout: "", stderr: "" };
    },
  });
  const api = packages.forHarness(owner);
  const first = api.ensure(request);
  expect(api.ensure(request)).toBe(first);
  await expect(first).rejects.toThrow("Download failed");
  const failed = jobs.list()[0]!;
  expect(failed.status).toBe("failed");
  jobs.retry(failed.id);
  await jobs.wait(failed.id);
  const result = await api.ensure(request);
  expect(JSON.parse(await readFile(join(result.path, "package.json"), "utf8"))).toEqual(request);
  expect(calls).toBe(2);
  expect(jobs.list()).toHaveLength(1);
  expect(jobs.list()[0]?.status).toBe("completed");
});
