import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary } from "./packaged-helpers";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const PACKAGE_JSON = join(REPO_ROOT, "packages/pstdio/package.json");
const BIN_ENTRYPOINT = join(REPO_ROOT, "packages/pstdio/bin/pstdio.cjs");
const BINARY_PATH = process.env.E2E_PACKAGED_BINARY_PATH ?? join(REPO_ROOT, "dist/pstdio");
const BUILD_TIMEOUT = 180_000;

let sandbox: string;
let entrypoint: string;

beforeAll(() => {
  buildBinary();

  // Stage the real npm entrypoint beside its platform package, as npm installs them.
  // Running the repository copy lets its optional dependencies shadow the fixture.
  // This simulates what npm installs when a user runs `npx pstdio`.
  sandbox = mkdtempSync(join(tmpdir(), "pstdio-npm-e2e-"));

  const binDir = join(sandbox, "node_modules", "pstdio", "bin");
  mkdirSync(binDir, { recursive: true });
  entrypoint = join(binDir, "pstdio.cjs");
  copyFileSync(BIN_ENTRYPOINT, entrypoint);
  copyFileSync(join(REPO_ROOT, "packages/pstdio/bin/resolve-package.cjs"), join(binDir, "resolve-package.cjs"));

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
      const output = execFileSync("node", [entrypoint, "--version"], {
        cwd: sandbox,
        encoding: "utf8",
        timeout: TEST_TIMEOUT,
      });
      expect(output.trim()).toMatch(/\d+\.\d+\.\d+/);
    },
    TEST_TIMEOUT,
  );
});
