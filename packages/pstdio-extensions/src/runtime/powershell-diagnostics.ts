import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment } from "./process-environment";

const root = mkdtempSync(join(tmpdir(), "powershell-probe-"));
const folder = join(root, "PowerShell Å tools");
mkdirSync(folder);
const script = join(folder, "only.ps1");
writeFileSync(script, 'Write-Output "1.2.3"');
const command = ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script];
const safe = createExtensionProcessEnvironment();

for (const mode of ["filtered", "full", "appdata", "stdin-pipe", "detached", "visible", "command"]) {
  const started = Date.now();
  const env = mode === "full" ? process.env : { ...safe };
  if (mode === "appdata") {
    env.APPDATA = process.env.APPDATA;
    env.LOCALAPPDATA = process.env.LOCALAPPDATA;
  }
  const child = Bun.spawn(mode === "command" ? [...command.slice(0, 5), "-Command", "Write-Output '1.2.3'"] : command, {
    env,
    detached: mode === "detached",
    windowsHide: mode !== "visible",
    stdin: mode === "stdin-pipe" ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (mode === "stdin-pipe") child.stdin?.end();
  const timer = setTimeout(() => {
    Bun.spawnSync(["taskkill.exe", "/PID", String(child.pid), "/T", "/F"], { stdout: "ignore", stderr: "ignore" });
    child.kill();
  }, 4000);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  clearTimeout(timer);
  console.log(JSON.stringify({ mode, elapsed: Date.now() - started, exitCode, stdout, stderr }));
}
rmSync(root, { recursive: true, force: true });
