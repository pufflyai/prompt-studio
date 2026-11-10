import { rm } from "node:fs/promises";
import { runTestCommand } from "./run-test-command";

// Literal paths travel through the environment, never through PowerShell source.
// .NET removes directory junctions themselves. Unsupported attributes/paths fall
// back to Node's force-removal semantics; cancellation still rejects and is reaped
// by the maintained pending-test-process owner rather than starting a fallback.
const WINDOWS_REMOVE = `
$ErrorActionPreference = 'Stop'
try {
  [System.IO.Directory]::Delete($env:PSTDIO_TEST_CLEANUP_ROOT, $true)
} catch [System.IO.DirectoryNotFoundException] {
} catch {
  [Console]::Out.WriteLine('PSTDIO_CLEANUP_FALLBACK: ' + $_.Exception.Message)
}
`;

export const removeTestDirectory = async (root: string) => {
  if (process.platform === "win32") {
    const began = performance.now();
    const result = await runTestCommand(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_REMOVE],
      { env: { ...process.env, PSTDIO_TEST_CLEANUP_ROOT: root } },
    );
    if (!result.stdout.includes("PSTDIO_CLEANUP_FALLBACK:")) {
      console.log(`Test directory removed with Windows native deletion (${Math.round(performance.now() - began)}ms)`);
      return;
    }
    console.log(result.stdout.trim());
  }
  await rm(root, { recursive: true, force: true });
};
