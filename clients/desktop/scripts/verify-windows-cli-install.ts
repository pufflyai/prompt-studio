import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { version } from "../package.json";
import { quotePowerShell, runWindowsPowerShell } from "../src/cli/windows-user-path";

if (process.platform !== "win32") throw new Error("Windows CLI installation verification requires Windows");
const execute = promisify(execFile);
const make = resolve(import.meta.dirname, "../out/make");
const installers = [...new Bun.Glob("**/*Setup.exe").scanSync({ cwd: make, absolute: true })];
assert.equal(installers.length, 1, "Expected one Windows installer");
assert.ok(process.env.LOCALAPPDATA, "LOCALAPPDATA is required");
const installRoot = join(process.env.LOCALAPPDATA, "PromptStudio");
assert.ok(!existsSync(installRoot), "Use a clean Windows account for installer verification");
const command = join(installRoot, "bin", "pst.cmd");
const updater = join(installRoot, "Update.exe");
const readPath = () =>
  runWindowsPowerShell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
try { ConvertTo-Json -Compress -InputObject ([string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)) }
finally { $key.Dispose() }
`);
const originalPath = await readPath();
let sidecar: string | undefined;
try {
  await execute(installers[0]!, ["--silent"]);
  assert.ok(existsSync(command), "Installer did not create pst.cmd");
  const appDirectory = readdirSync(installRoot).find((name) => name.startsWith("app-"));
  assert.ok(appDirectory, "Installer did not create a versioned app folder");
  const executable = join(installRoot, appDirectory, "Prompt Studio.exe");
  sidecar = join(installRoot, appDirectory, "resources", "bin", "pstdio.exe");
  const checkCommand = async () => {
    // Emulate a new terminal: CI's existing parent process retains its old PATH.
    const output = await runWindowsPowerShell(`
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
if ((Get-Command pst).Source -ne ${quotePowerShell(command)}) { throw 'pst does not resolve to the installed desktop' }
& pst --version
if ($LASTEXITCODE -ne 0) { throw 'pst failed' }
`);
    assert.equal(output, version);
  };
  await checkCommand();
  const installedPath = await readPath();
  await execute(executable, ["--squirrel-updated", version]);
  await execute(executable, ["--squirrel-obsolete", version]);
  assert.equal(await readPath(), installedPath, "Update duplicated or removed the PATH entry");
  await checkCommand();
  console.log("Windows install, update, and obsolete hooks preserve a working pst command.");
} finally {
  if (sidecar && existsSync(sidecar)) await execute(sidecar, ["close"]).catch(() => {});
  if (existsSync(updater)) await execute(updater, ["--uninstall", "--silent"]);
}
assert.ok(!existsSync(command), "Uninstall left the desktop command behind");
assert.equal(await readPath(), originalPath, "Uninstall did not restore the existing user PATH");
console.log("Windows uninstall removes the command and preserves the original user PATH.");
