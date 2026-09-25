import { closeSync, openSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "clients/desktop/test-results/native-system-profile");
await mkdir(output, { recursive: true });
const machine = Bun.spawn(["sysctl", "hw.ncpu", "machdep.cpu.brand_string", "hw.memsize"], { stdout: "pipe" });
await writeFile(resolve(output, "machine.txt"), await new Response(machine.stdout).text());
await machine.exited;

const helper = resolve(root, "clients/desktop/src/e2e/packaged-app-helpers.ts");
let source = await Bun.file(helper).text();
source = `import { startNativeCpuProfiles } from "./native-cpu-profile";\n${source}`;
source = source.replace(
  "const lifecyclePage = await waitForLifecyclePage(context);",
  "const stopProfiles = startNativeCpuProfiles(context, child.pid);\n    registerPackagedCleanup(stopProfiles);\n    const lifecyclePage = await waitForLifecyclePage(context);",
);
source = source.replace(
  /const finishTrace = (await startElectronTrace\([^\n]+\);)/,
  (_match, startTrace) =>
    `const finishBrowserTrace = ${startTrace}\n    const finishTrace = async () => { await stopProfiles(); await finishBrowserTrace(); };`,
);
await Bun.write(helper, source);

const topOutput = openSync(resolve(output, "system-top.log"), "w");
const top = Bun.spawn(["top", "-l", "0", "-s", "1", "-n", "0"], { stdout: topOutput, stderr: "ignore" });
closeSync(topOutput);
const child = Bun.spawn(
  [
    "bunx",
    "playwright",
    "test",
    "--config",
    "playwright.packaged.config.ts",
    "--grep",
    "protects a running terminal|proves cold packaged startup|promotes ownership|shows recovery promptly",
  ],
  {
    cwd: resolve(root, "clients/desktop"),
    stdout: "inherit",
    stderr: "inherit",
  },
);
let finished = false;
const exit = child.exited.then((code) => {
  finished = true;
  return code;
});
const seen = new Map<number, number>();
const sampled = new Set<string>();
let sample: Promise<void> | undefined;
while (!finished) {
  const ps = Bun.spawn(["ps", "-axo", "pid=,ppid=,pgid=,pcpu=,rss=,etime=,time=,state=,comm="], { stdout: "pipe" });
  const rows = (await new Response(ps.stdout).text()).trim().split("\n");
  await ps.exited;
  const processes = rows.flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    return match
      ? [
          {
            pid: Number(match[1]),
            ppid: Number(match[2]),
            pgid: Number(match[3]),
            cpu: Number(match[4]),
            rss: Number(match[5]),
            elapsed: match[6],
            cpuTime: match[7],
            state: match[8],
            command: match[9],
          },
        ]
      : [];
  });
  const relevant = processes.filter((process) => process.cpu >= 5 || process.command.includes("Prompt Studio"));
  await appendFile(resolve(output, "processes.jsonl"), `${JSON.stringify({ at: Date.now(), processes: relevant })}\n`);
  const candidates = relevant.flatMap((process) => {
    if (
      !process.command.includes("Prompt Studio") ||
      !/(?:\/Prompt Studio$|\/pstdio$|Helper \(Renderer\))/.test(process.command)
    )
      return [];
    if (!seen.has(process.pid)) seen.set(process.pid, Date.now());
    const age = Date.now() - seen.get(process.pid)!;
    const phase = age >= 6_000 && !sampled.has(`${process.pid}-late`) ? "late" : "early";
    const key = `${process.pid}-${phase}`;
    return age >= 1_500 && !sampled.has(key) ? [{ ...process, phase, key }] : [];
  });
  const candidate = candidates.sort(
    (left, right) => Number(right.phase === "late") - Number(left.phase === "late") || right.cpu - left.cpu,
  )[0];
  if (!sample && candidate && sampled.size < 40) {
    sampled.add(candidate.key);
    await appendFile(resolve(output, "samples.jsonl"), `${JSON.stringify({ at: Date.now(), ...candidate })}\n`);
    const sampler = Bun.spawn(
      ["sample", String(candidate.pid), "1", "10", "-file", resolve(output, `sample-${candidate.key}.txt`)],
      { stdout: "ignore", stderr: "ignore" },
    );
    sample = sampler.exited
      .then(() => undefined)
      .finally(() => {
        sample = undefined;
      });
  }
  await Bun.sleep(500);
}
await sample;
top.kill("SIGTERM");
await top.exited;
process.exit(await exit);
