import { expect } from "bun:test";
import { existsSync, linkSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { runTestCommand } from "../scripts/run-test-command";

const dotnet = `
$ErrorActionPreference = 'Stop'
$cleanupProcess = [Diagnostics.Process]::GetCurrentProcess()
$cleanupInfo = @{
  phase = 'runtime'
  path = $cleanupProcess.MainModule.FileName
  powershell = $PSVersionTable.PSVersion.ToString()
  framework = [System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription
  architecture = [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()
}
[Console]::Error.WriteLine(('Native directory cleanup ' + ($cleanupInfo | ConvertTo-Json -Compress)))
$cleanupWatch = [Diagnostics.Stopwatch]::StartNew()
[IO.Directory]::Delete($env:E2E_CORE_CLEANUP_ROOT, $true)
$cleanupWatch.Stop()
$cleanupProcess.Refresh()
[Console]::Error.WriteLine(('Native directory cleanup ' + (@{
  phase = 'removed'
  elapsedMs = $cleanupWatch.Elapsed.TotalMilliseconds
  peakRssBytes = $cleanupProcess.PeakWorkingSet64
  cpuMs = $cleanupProcess.TotalProcessorTime.TotalMilliseconds
} | ConvertTo-Json -Compress)))
$cleanupProcess.Dispose()
`;

const classifyLink = async (path: string, canonical: string) => {
  let target: string;
  try {
    target = await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return "brokenLinks" as const;
  }
  const within = relative(canonical, target);
  return within.startsWith("..") || isAbsolute(within) ? ("externalLinks" as const) : ("internalLinks" as const);
};

export const removeDiagnosticNativeCore = async (root: string) => {
  const counts = { files: 0, directories: 0, links: 0, internalLinks: 0, externalLinks: 0, brokenLinks: 0 };
  const canonical = await realpath(root);
  const inventoryStarted = Date.now();
  const count = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        counts.links++;
        counts[await classifyLink(path, canonical)]++;
      } else if (entry.isDirectory()) {
        counts.directories++;
        await count(path);
      } else counts.files++;
    }
  };
  await count(root);
  console.log(
    "Native directory cleanup tree",
    JSON.stringify({ root, ...counts, inventoryMs: Date.now() - inventoryStarted }),
  );
  const external = mkdtempSync(join(tmpdir(), "pstdio-native-cleanup-sentinel-"));
  const sentinel = join(external, "retained.txt");
  writeFileSync(sentinel, "retained");
  symlinkSync(external, join(root, "external-cleanup-target"), "junction");
  linkSync(sentinel, join(root, "hard-linked-sentinel.txt"));
  const env = { ...process.env, E2E_CORE_CLEANUP_ROOT: root };
  const mode = process.env.E2E_NATIVE_REMOVAL;
  const started = Date.now();
  try {
    if (mode === "cmd") {
      await runTestCommand("cmd.exe", ["/d", "/s", "/c", 'rmdir /s /q "%E2E_CORE_CLEANUP_ROOT%"'], {
        cwd: tmpdir(),
        env,
        windowsVerbatimArguments: true,
      });
    } else if (mode === "dotnet") {
      await runTestCommand("pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", dotnet], {
        cwd: tmpdir(),
        env,
      });
    } else throw new Error(`Unknown native removal method: ${mode}`);
    expect(existsSync(root)).toBe(false);
    expect(await Bun.file(sentinel).text()).toBe("retained");
    console.log(
      "Native directory cleanup child closed",
      JSON.stringify({ mode, elapsedMs: Date.now() - started, ...counts }),
    );
  } finally {
    await rm(external, { recursive: true, force: true });
  }
};
