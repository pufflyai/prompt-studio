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
  "const stopProfiles = startNativeCpuProfiles(context);\n    registerPackagedCleanup(stopProfiles);\n    const lifecyclePage = await waitForLifecyclePage(context);",
);
source = source.replace(
  /const finishTrace = (await startElectronTrace\([^\n]+\);)/,
  (_match, startTrace) =>
    `const finishBrowserTrace = ${startTrace}\n    const finishTrace = async () => { await stopProfiles(); await finishBrowserTrace(); };`,
);
await Bun.write(helper, source);

const child = Bun.spawn(["bunx", "playwright", "test", "--config", "playwright.packaged.config.ts"], {
  cwd: resolve(root, "clients/desktop"),
  stdout: "inherit",
  stderr: "inherit",
});
let finished = false;
const exit = child.exited.then((code) => {
  finished = true;
  return code;
});
const sampled = new Set<number>();
let sample: Promise<void> | undefined;
while (!finished) {
  const ps = Bun.spawn(["ps", "-axo", "pid=,ppid=,pgid=,pcpu=,rss=,etime=,comm="], { stdout: "pipe" });
  const rows = (await new Response(ps.stdout).text()).trim().split("\n");
  await ps.exited;
  const processes = rows.flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/);
    return match
      ? [
          {
            pid: Number(match[1]),
            ppid: Number(match[2]),
            pgid: Number(match[3]),
            cpu: Number(match[4]),
            rss: Number(match[5]),
            elapsed: match[6],
            command: match[7],
          },
        ]
      : [];
  });
  const relevant = processes.filter((process) => process.cpu >= 5 || process.command.includes("Prompt Studio"));
  await appendFile(resolve(output, "processes.jsonl"), `${JSON.stringify({ at: Date.now(), processes: relevant })}\n`);
  const candidate = relevant
    .filter((process) => process.cpu >= 10 && process.command.includes("Prompt Studio") && !sampled.has(process.pid))
    .sort((left, right) => right.cpu - left.cpu)[0];
  if (!sample && candidate && sampled.size < 18) {
    sampled.add(candidate.pid);
    const sampler = Bun.spawn(
      ["sample", String(candidate.pid), "1", "10", "-file", resolve(output, `sample-${candidate.pid}.txt`)],
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
process.exit(await exit);
