import { lstat, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { runTestCommand, TestCommandError } from "../scripts/run-test-command";

// ADR 0039: transient Windows handles need Node's asynchronous retry contract.
const ASYNC_REMOVE = `
require("node:fs/promises").rm(process.env.PSTDIO_TEST_CLEANUP_ROOT, {
  recursive: true, force: true, maxRetries: 5, retryDelay: 100,
}).catch((error) => { console.error(error); process.exitCode = 1; });
`;

const removeNativeDirectory = async (root: string) => {
  const env = { ...process.env, PSTDIO_TEST_CLEANUP_ROOT: root };
  try {
    // Own the utility directly so cancellation also stops traversal. Paths stay
    // literal; Windows expands the quoted environment value only once.
    if (process.platform === "win32")
      await runTestCommand(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/v:off", "/s", "/c", 'rmdir /s /q "%PSTDIO_TEST_CLEANUP_ROOT%"'],
        { env, windowsVerbatimArguments: true },
      );
    else await runTestCommand("/bin/rm", ["-rf", "--", root], { env });
  } catch (error) {
    // Cancellation and signal termination must never start a second traversal.
    if (!(error instanceof TestCommandError) || error.signal || process.platform !== "win32") throw error;
    console.error("PSTDIO_CLEANUP_ASYNC_RECOVERY: native removal failed");
    await runTestCommand("node", ["-e", ASYNC_REMOVE], { env });
  }
};

export const removeTestDirectory = async (root: string) => {
  const info = await lstat(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) return rm(root, { recursive: true, force: true });
  const began = performance.now();
  const entries = await readdir(root, { withFileTypes: true });
  const trees: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = join(root, entry.name);
    if (process.platform === "win32" && entry.name === "extensions") {
      // Installed packages are independent; never enumerate a linked directory.
      for (const installed of await readdir(directory, { withFileTypes: true }))
        if (installed.isDirectory() && !installed.isSymbolicLink()) trees.push(join(directory, installed.name));
    } else trees.push(directory);
  }
  console.log(
    `Test directory cleanup: ${trees.length} independent trees started (${Math.round(performance.now() - began)}ms)`,
  );
  let next = 0;
  const drain = async () => {
    while (next < trees.length) {
      const directory = trees[next++]!;
      const started = performance.now();
      await removeNativeDirectory(directory);
      console.log(
        `Test directory cleanup: ${directory.slice(root.length + 1)} removed (${Math.round(performance.now() - started)}ms)`,
      );
    }
  };
  // Bound this owned removal to four direct utilities across all independent trees.
  // Settle every sibling before removing the parent or propagating an error.
  const outcomes = await Promise.allSettled(Array.from({ length: Math.min(4, trees.length) }, drain));
  const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
  if (failures.length) throw new AggregateError(failures, "Test directory cleanup failed");
  console.log(`Test directory cleanup: remaining root started (${Math.round(performance.now() - began)}ms)`);
  await removeNativeDirectory(root);
  console.log(`Test directory removed with platform utility (${Math.round(performance.now() - began)}ms)`);
};
