import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { cleanupDirs, createGitRepo, createTempDir, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const env = () => ({ PSTDIO_API_URL: api.url, PSTDIO_DEFAULT_EXTENSIONS: "[]" });

const writeExtension = (root: string) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "path-tool",
      publisher: "test",
      version: "1.0.0",
      type: "module",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "extension.ts"), "export default {};\n");
  return root;
};

describe("pstdio extensions add with a relative source", () => {
  test(
    "installs the current folder from inside a linked project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);
      runPstdio("projects create add-paths-project", repo, env());
      const source = writeExtension(join(repo, "tools", "path-tool"));

      const output = runPstdio("extensions add . --skip-install", source, env());

      expect(output).toContain("Id: test.path-tool");
    },
    TEST_TIMEOUT,
  );

  test(
    "explains how to install the current folder from outside a linked project",
    () => {
      const author = createTempDir();
      dirs.push(author);
      const source = writeExtension(join(author, "path-tool"));

      const result = runPstdioSafe("extensions add . --skip-install", source, env());

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`pst extensions add ${realpathSync(source)}`);
      expect(result.stderr).toContain("pst projects create");
    },
    TEST_TIMEOUT,
  );
});
