import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSmokeContext } from "./smoke-isolation";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "smoke-input-"));
  roots.push(root);
  return root;
};
const manifest = (root: string, data = {}) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify(data));
};

test("stages source and fixture context without linking the caller or inheriting routing", async () => {
  const root = fixture();
  const source = join(root, "extension");
  manifest(source, { dependencies: { local: "file:../local" } });
  manifest(join(root, "local"));
  mkdirSync(join(root, ".pstdio"));
  writeFileSync(join(root, ".pstdio/config.json"), '{"project_id":"caller"}');
  const context = await createSmokeContext({
    source,
    projectPath: root,
    env: { PATH: process.env.PATH, PSTDIO_API_URL: "http://caller", PSTDIO_DEFAULT_EXTENSIONS: "caller" },
  });
  roots.push(context.root);
  expect(context.source).not.toBe(source);
  expect(readFileSync(join(context.source, "package.json"), "utf8")).toBe(
    readFileSync(join(source, "package.json"), "utf8"),
  );
  expect(existsSync(join(context.project, ".pstdio/config.json"))).toBe(false);
  expect(context.env.PSTDIO_API_URL).toBeUndefined();
  expect(context.env.PSTDIO_DEFAULT_EXTENSIONS).toBe("[]");
  expect(context.env.PSTDIO_HOME).toBe(context.home);
});

test("rejects directory dependencies and symlinks outside the supplied context", async () => {
  const root = fixture();
  const source = join(root, "extension");
  manifest(source, { dependencies: { local: "file:../local" } });
  manifest(join(root, "local"));
  await expect(createSmokeContext({ source })).rejects.toThrow("--project-path");
  manifest(source);
  symlinkSync(join(root, "local"), join(source, "external"));
  await expect(createSmokeContext({ source })).rejects.toThrow("outside");
});

test("creates a scratch git repo and ignores existing installs", async () => {
  const source = fixture();
  manifest(source);
  mkdirSync(join(source, "node_modules"));
  const context = await createSmokeContext({ source });
  roots.push(context.root);
  expect(existsSync(join(context.project, ".git"))).toBe(true);
  expect(existsSync(join(context.source, "node_modules"))).toBe(false);
});

test("stages repo-local extension sources while preserving fixture data without caller installs", async () => {
  const root = fixture();
  const source = join(root, ".pstdio/extensions/local-tool");
  manifest(source);
  const data = join(root, ".pstdio/tool-data");
  mkdirSync(data);
  writeFileSync(join(data, "fixture.json"), "{}");
  const context = await createSmokeContext({ source, projectPath: root });
  roots.push(context.root);
  expect(existsSync(join(context.source, "package.json"))).toBe(true);
  expect(existsSync(join(context.project, ".pstdio/tool-data/fixture.json"))).toBe(true);
  expect(existsSync(join(context.project, ".pstdio/extensions"))).toBe(false);
});
