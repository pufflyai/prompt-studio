import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const home = mkdtempSync(join(tmpdir(), "pstdio-installed-"));
const env = { ...process.env, PSTDIO_HOME: home, PSTDIO_LOG_PATH: join(home, "logs.jsonl") };
delete env.ELECTRON_RUN_AS_NODE;
const launcher = join(process.env.LOCALAPPDATA!, "PromptStudio", "Prompt Studio.exe");
const run = async (file: string, args: string[]) => {
  const result = await execute(file, args, { env, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return result.stdout.trim();
};
await run(process.env.PSTDIO_DIAG_SETUP!, ["--silent"]);
const version = await run(join(process.env.LOCALAPPDATA!, "PromptStudio/app-0.43.0/resources/bin/pstdio.exe"), ["--version"]);
writeFileSync("evidence/sidecar-version.txt", version);
const shortcuts = await run("pwsh", ["-NoProfile", "-NonInteractive", "-Command", `
  $shell = New-Object -ComObject WScript.Shell
  Get-ChildItem ([Environment]::GetFolderPath('Programs')) -Recurse -Filter '*.lnk' |
    ForEach-Object { $link = $shell.CreateShortcut($_.FullName); if ($link.TargetPath -eq '${launcher.replaceAll("'", "''")}') {
      @{ path = $_.FullName; target = $link.TargetPath; arguments = $link.Arguments }
    }} | ConvertTo-Json -AsArray
`]);
writeFileSync("evidence/bun-filtered-shortcuts.json", shortcuts);
assert(shortcuts.includes("Prompt Studio.exe"), "Start menu shortcut must launch the installed app");
