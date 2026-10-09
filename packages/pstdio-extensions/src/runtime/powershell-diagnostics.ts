import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment } from "./process-environment";

const root = mkdtempSync(join(tmpdir(), "powershell-probe-"));
const script = join(root, "only.ps1");
writeFileSync(script, 'Write-Output "1.2.3"');
const command = ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script];
const safe = createExtensionProcessEnvironment();
const safeNames = new Set(Object.keys(safe).map((name) => name.toLowerCase()));
let extras = Object.keys(process.env).filter((name) => !safeNames.has(name.toLowerCase()));
let probe = 0;

const works = async (names: string[]) => {
  const started = Date.now();
  const env = { ...safe };
  for (const name of names) env[name] = process.env[name];
  const child = Bun.spawn(command, {
    env,
    detached: false,
    windowsHide: true,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => {
    Bun.spawnSync(["taskkill.exe", "/PID", String(child.pid), "/T", "/F"], { stdout: "ignore", stderr: "ignore" });
    child.kill();
  }, 4000);
  const [stdout, , exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  clearTimeout(timer);
  const success = exitCode === 0 && stdout.trim() === "1.2.3";
  console.log(JSON.stringify({ probe: ++probe, variables: names.length, elapsed: Date.now() - started, success }));
  return success;
};

if (await works(extras)) {
  for (let size = Math.ceil(extras.length / 2); size >= 1; size = Math.floor(size / 2)) {
    for (let index = 0; index < extras.length; ) {
      const candidate = extras.filter((_, position) => position < index || position >= index + size);
      if (await works(candidate)) extras = candidate;
      else index += size;
    }
  }
  console.log(JSON.stringify({ requiredVariables: extras }));
} else {
  console.log("Adding the omitted environment names did not restore PowerShell.");
}
rmSync(root, { recursive: true, force: true });
