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
  if (process.platform === "win32") {
    const extensions = join(root, "extensions");
    const installed = await lstat(extensions).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (installed?.isDirectory() && !installed.isSymbolicLink()) {
      const names = await readdir(extensions);
      let next = 0;
      const drain = async () => {
        while (next < names.length) await removeNativeDirectory(join(extensions, names[next++]!));
      };
      // Installed packages are independent trees. Bound deletion to four direct,
      // case-owned utilities and settle all before deleting their parent.
      const outcomes = await Promise.allSettled(Array.from({ length: Math.min(4, names.length) }, drain));
      const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []));
      if (failures.length) throw new AggregateError(failures, "Installed extension cleanup failed");
    }
  }
  await removeNativeDirectory(root);
  console.log(`Test directory removed with platform utility (${Math.round(performance.now() - began)}ms)`);
};
