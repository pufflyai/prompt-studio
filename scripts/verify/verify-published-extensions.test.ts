import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishedExtensionDirs, stageExtension } from "./verify-published-extensions";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "published-extensions-test-"));
  roots.push(root);
  return root;
};
const write = async (root: string, path: string, content: unknown) => {
  const destination = join(root, path);
  await mkdir(join(destination, ".."), { recursive: true });
  await writeFile(destination, typeof content === "string" ? content : JSON.stringify(content));
};

test("finds registry-backed extensions across workspace locations and excludes local SDK consumers", async () => {
  const root = await fixture();
  await write(root, "package.json", { workspaces: ["extensions/*", ".pstdio/extensions/dev", "packages/*"] });
  await write(root, ".changeset/config.json", { fixed: [["released-tool"]] });
  const manifest = (sdk: string) => ({
    name: "released-tool",
      engines: { pstdio: "^0.1.0" },
    dependencies: { "@pstdio/sdk": sdk },
  });
  await write(root, "extensions/published/package.json", manifest("^0.35.0"));
  await write(root, "extensions/unreleased/package.json", { ...manifest("^0.35.0"), name: "local-tool" });
  await write(root, "extensions/local/package.json", manifest("workspace:*"));
  await write(root, ".pstdio/extensions/dev/package.json", manifest("^0.35.0"));
  await write(root, "packages/library/package.json", { dependencies: { "@pstdio/sdk": "^0.35.0" } });
  expect(await publishedExtensionDirs(root)).toEqual([
    join(".pstdio", "extensions", "dev"),
    join("extensions", "published"),
  ]);
});

test("stages source and test support outside the workspace without workspace dependencies or installed artifacts", async () => {
  const root = await fixture();
  const destination = await fixture();
  await write(root, "tsconfig.base.json", { compilerOptions: { strict: true } });
  await write(root, "scripts/test-setup.ts", "export {};\n");
  await write(root, "extensions/tool/package.json", { dependencies: { "@pstdio/sdk": "^0.35.0" } });
  await write(root, "extensions/tool/extension.ts", "export default {};\n");
  await write(root, "extensions/tool/bun.lock", "old resolution");
  await write(root, "extensions/tool/node_modules/@pstdio/sdk/index.ts", "unreleased");
  await write(root, "extensions/tool/dist/index.js", "stale");
  await write(root, "packages/sdk/index.ts", "unreleased");
  const staged = await stageExtension(root, "extensions/tool", destination);
  expect(await Bun.file(join(staged, "extension.ts")).text()).toContain("export default");
  expect(await Bun.file(join(staged, "package.json")).json()).toEqual({ dependencies: { "@pstdio/sdk": "^0.35.0" } });
  expect(await Bun.file(join(destination, "scripts/test-setup.ts")).exists()).toBe(true);
  expect(await Bun.file(join(destination, "tsconfig.base.json")).exists()).toBe(true);
  for (const path of [
    "bun.lock",
    "node_modules/@pstdio/sdk/index.ts",
    "dist/index.js",
    "../../packages/sdk/index.ts",
  ]) {
    expect(await Bun.file(join(staged, path)).exists()).toBe(false);
  }
});
