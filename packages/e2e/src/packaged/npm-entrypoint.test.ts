import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary } from "./packaged-helpers";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const PACKAGE_JSON = join(REPO_ROOT, "packages/pstdio/package.json");
const BIN_ENTRYPOINT = join(REPO_ROOT, "packages/pstdio/bin/pstdio.cjs");
const BINARY_PATH = join(REPO_ROOT, "dist/pstdio");
const BUILD_TIMEOUT = 180_000;

let sandbox: string;

beforeAll(() => {
  buildBinary();

  // Create a temp directory with a fake platform package that points to the real binary.
  // This simulates what npm installs when a user runs `npx pstdio`.
  sandbox = mkdtempSync(join(tmpdir(), "pstdio-npm-e2e-"));

  const resolvePackageName = require(join(REPO_ROOT, "packages/pstdio/bin/resolve-package.cjs")).resolvePackageName;
  const platformPkg = resolvePackageName(process.platform, process.arch);
  const pkgDir = join(sandbox, "node_modules", ...platformPkg.split("/"));

  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: platformPkg, main: "./index.cjs" }));
  writeFileSync(join(pkgDir, "index.cjs"), `module.exports = ${JSON.stringify(BINARY_PATH)};\n`);
}, BUILD_TIMEOUT);

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

describe("npm entrypoint (bin/pstdio.cjs via node)", () => {
  test("declares pst as an npm binary alias", () => {
    const packageJson = require(PACKAGE_JSON);
    expect(packageJson.bin.pst).toBe(packageJson.bin.pstdio);
  });

  test(
    "runs --version through the node entrypoint",
    () => {
      const output = execSync(`node ${BIN_ENTRYPOINT} --version`, {
        cwd: sandbox,
        encoding: "utf8",
        env: { ...process.env, NODE_PATH: join(sandbox, "node_modules") },
        timeout: TEST_TIMEOUT,
      });
      expect(output.trim()).toMatch(/\d+\.\d+\.\d+/);
    },
    TEST_TIMEOUT,
  );
});
