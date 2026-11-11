import { lstat, rm } from "node:fs/promises";
import { runTestCommand, TestCommandError } from "../scripts/run-test-command";

// ADR 0039: transient Windows handles need Node's asynchronous retry contract.
const ASYNC_REMOVE = `
require("node:fs/promises").rm(process.env.PSTDIO_TEST_CLEANUP_ROOT, {
  recursive: true, force: true, maxRetries: 5, retryDelay: 100,
}).catch((error) => { console.error(error); process.exitCode = 1; });
`;

export const removeTestDirectory = async (root: string) => {
  const info = await lstat(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) return rm(root, { recursive: true, force: true });
  const began = performance.now();
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
  console.log(`Test directory removed with platform utility (${Math.round(performance.now() - began)}ms)`);
};
