import { lstat, rm } from "node:fs/promises";
import { runTestCommand } from "./run-test-command";

// Reuse the desktop fixtures' Node native traversal from Bun-run packaged tests,
// with one deletion task at a time and complete removal inside the case.
// Keep paths literal and let the runner own cancellation of this subprocess.
const NATIVE_REMOVE = `
const { rmSync, promises: { rm } } = require("node:fs");
console.log("PSTDIO_CLEANUP_ENGINE: node " + process.version + " " + process.arch);
const remove = async () => {
  const options = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 };
  // ADR 0039: Node 24's synchronous Windows removal does not honor these retries.
  if (process.platform === "win32") await rm(process.env.PSTDIO_TEST_CLEANUP_ROOT, options);
  else rmSync(process.env.PSTDIO_TEST_CLEANUP_ROOT, options);
};
remove().catch((error) => {
  console.log("PSTDIO_CLEANUP_FALLBACK: " + error.message);
});
`;

export const removeTestDirectory = async (root: string) => {
  const info = await lstat(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) return rm(root, { recursive: true, force: true });
  const began = performance.now();
  const result = await runTestCommand("node", ["-e", NATIVE_REMOVE], {
    env: { ...process.env, PSTDIO_TEST_CLEANUP_ROOT: root },
  }).catch((error: unknown) => {
    // Node is part of CI's toolchain; Bun-only local test runs can still clean up.
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  if (result) console.log(result.stdout.trim());
  if (result && !result.stdout.includes("PSTDIO_CLEANUP_FALLBACK:")) {
    console.log(`Test directory removed with Node native deletion (${Math.round(performance.now() - began)}ms)`);
    return;
  }
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
};
