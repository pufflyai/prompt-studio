import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEST_TIMEOUT } from "../cli/timeouts";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
export const PACKAGED_BINARY_PATH = process.env.PSTDIO_PACKAGED_BINARY_PATH ?? join(REPO_ROOT, "dist/pstdio");
const EXTRACTED_FILES_ROOT = join(tmpdir(), "pstdio-files");
let preparedBinaryPath: string | null = null;

export const buildBinary = () => {
  if (preparedBinaryPath === PACKAGED_BINARY_PATH) return;

  if (process.env.PSTDIO_PACKAGED_BINARY_PATH) {
    if (!existsSync(PACKAGED_BINARY_PATH)) {
      throw new Error(`Packaged binary not found at ${PACKAGED_BINARY_PATH}`);
    }
    preparedBinaryPath = PACKAGED_BINARY_PATH;
    return;
  }

  console.log("Compiling pstdio binary for local platform…");
  rmSync(EXTRACTED_FILES_ROOT, { recursive: true, force: true });
  execSync("bun run --cwd scripts build:host", {
    cwd: REPO_ROOT,
    stdio: "inherit",
    timeout: 300_000,
  });

  if (!existsSync(PACKAGED_BINARY_PATH)) {
    throw new Error(`Compiled binary not found at ${PACKAGED_BINARY_PATH}`);
  }
  preparedBinaryPath = PACKAGED_BINARY_PATH;
};

export const runPackaged = (args: string, cwd: string, env: Record<string, string>) =>
  execSync(`${PACKAGED_BINARY_PATH} ${args}`, {
    cwd,
    env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: "[]", ...env },
    encoding: "utf8",
    timeout: TEST_TIMEOUT,
  });

export const runPackagedSafe = (args: string, cwd: string, env: Record<string, string>) => {
  try {
    const stdout = execSync(`${PACKAGED_BINARY_PATH} ${args}`, {
      cwd,
      env: { ...process.env, PSTDIO_DEFAULT_EXTENSIONS: "[]", ...env },
      encoding: "utf8",
      timeout: TEST_TIMEOUT,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? 1,
    };
  }
};
