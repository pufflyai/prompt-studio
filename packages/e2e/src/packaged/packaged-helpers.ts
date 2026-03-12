import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TEST_TIMEOUT } from "../cli/timeouts";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const BINARY_PATH = join(REPO_ROOT, "dist/pstdio");

export const buildBinary = () => {
  console.log("Compiling pstdio binary for local platform…");
  execSync("bun run scripts/build-compile.ts", {
    cwd: REPO_ROOT,
    stdio: "inherit",
    timeout: 300_000,
  });

  if (!existsSync(BINARY_PATH)) {
    throw new Error(`Compiled binary not found at ${BINARY_PATH}`);
  }
};

export const runPackaged = (args: string, cwd: string, env: Record<string, string>) =>
  execSync(`${BINARY_PATH} ${args}`, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: TEST_TIMEOUT,
  });

export const runPackagedSafe = (args: string, cwd: string, env: Record<string, string>) => {
  try {
    const stdout = execSync(`${BINARY_PATH} ${args}`, {
      cwd,
      env: { ...process.env, ...env },
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
