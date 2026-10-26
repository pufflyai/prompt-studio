import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.env.PS932_TRACE_ROOT;
if (!root) throw new Error("Downloaded trace root is required");
const traces = [...new Bun.Glob("**/defender.etl").scanSync({ cwd: root, absolute: true })];
if (traces.length !== 1) throw new Error(`Expected one saved trace, received ${traces.length}`);
const trace = traces[0];
const output = join(root, "analysis");
await mkdir(output);
const summaryPaths = [...new Bun.Glob("**/summary.json").scanSync({ cwd: root, absolute: true })];
if (summaryPaths.length !== 1) throw new Error("Original timing summary is required");
const summary = await Bun.file(summaryPaths[0]).json();
const requests = [
  { name: "overview", args: "-Overview" },
  { name: "top-scans", args: "-TopFiles 30 -TopProcesses 10 -TopScans 30" },
  ...summary
    .filter((item: { extractStartedAt?: string }) => item.extractStartedAt)
    .map((item: { name: string; extractStartedAt: string; extractFinishedAt: string }) => ({
      name: item.name.replaceAll("/", "-"),
      args: `-TopFiles 20 -TopScans 20 -MinStartTime ([datetime]$env:PS932_START) -MaxStartTime ([datetime]$env:PS932_END)`,
      startedAt: item.extractStartedAt,
      finishedAt: item.extractFinishedAt,
    })),
];
for (const request of requests) {
  const child = Bun.spawn(
    [
      "powershell.exe",
      "-NoProfile",
      "-Command",
      `$ErrorActionPreference='Stop'; Get-MpPerformanceReport -Path $env:PS932_TRACE ${request.args} -Raw | ConvertTo-Json -Depth 30`,
    ],
    {
      env: { ...process.env, PS932_TRACE: trace, PS932_START: request.startedAt, PS932_END: request.finishedAt },
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await writeFile(join(output, `${request.name}.json`), stdout);
  await writeFile(join(output, `${request.name}.stderr.log`), stderr);
  console.log(JSON.stringify({ name: request.name, exitCode, stdout, stderr }));
  if (exitCode !== 0) process.exitCode = 1;
}
