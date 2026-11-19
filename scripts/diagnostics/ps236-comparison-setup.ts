// Temporary isolated acceptance driver, excluded from benchmark discovery and qualification.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [appArgument, stack, variant, browserTools] = process.argv.slice(2);
const app = resolve(appArgument!);
const output = resolve("comparison-evidence", variant!);
mkdirSync(output, { recursive: true });
const evidence: Record<string, unknown> = { variant, stack, measurements: [], errors: [] };
const save = () => writeFileSync(join(output, "result.json"), JSON.stringify(evidence, null, 2));
process.on("uncaughtException", (error) => {
  (evidence.errors as unknown[]).push({ name: "setup-or-driver", error: String(error) });
  save();
  console.error(error);
  process.exitCode = 1;
});
const shell = (args: string[], cwd = app) => {
  const result = spawnSync(args[0]!, args.slice(1), { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, `${args[0]}: ${result.stderr.slice(-2000)}`);
  return result.stdout.trim();
};
evidence.source = shell(["git", "rev-parse", "HEAD"]);
evidence.environment = { platform: process.platform, arch: process.arch, node: process.version, bun: Bun.version };
const connection = JSON.parse(
  readFileSync(join(app, "__test-tmp__", "dev-isolated", stack!, "connection.json"), "utf8"),
);
const origin = `http://127.0.0.1:${connection.apiPort}`;
const uiOrigin = connection.dashboardUrl.replace(/\/$/, "");
const headers = { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" };
const request = async (path: string, body?: unknown, allowance = 30_000) => {
  const response = await fetch(origin + path, {
    headers,
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(allowance),
  });
  assert.ok(response.ok, `${path}: ${response.status} ${(await response.clone().text()).slice(0, 200)}`);
  return response.json();
};
const projects = await request("/v1/projects");
const project = projects.find((p: { name: string }) => p.name === "project");
assert.ok(project);
evidence.project = project.id;
const execute = async (id: string, params = {}, allowance = 30_000) => {
  const result = await request(`/v1/projects/${project.id}/extensions/commands/${id}/execute`, { params }, allowance);
  assert.equal(result.outcome?.status, "success", JSON.stringify(result.outcome));
  return result.outcome.value;
};
const planner = (name: string, params = {}) => execute(`pstdio.planner.command.${name}`, params);
const counters = () => request("/runtime/benchmark-counters");
const delta = (a: Record<string, number>, b: Record<string, number>) =>
  Object.fromEntries(Object.keys(a).map((key) => [key, b[key]! - a[key]!]));
const measurements = evidence.measurements as unknown[];
const measure = async <T>(name: string, run: () => Promise<T>) => {
  const before = await counters(),
    started = performance.now();
  const value = await run();
  const ms = performance.now() - started;
  measurements.push({ name, ms, counters: delta(before, await counters()) });
  save();
  return value;
};

const setupStart = performance.now();
const ids: string[] = [];
for (let start = 0; start < 5000; start += 100) {
  const tickets = Array.from({ length: 100 }, (_, offset) => {
    const n = start + offset,
      key = `demo-${n}`,
      title = `Scale ticket ${String(n).padStart(5, "0")}`;
    return {
      key,
      content: `# ${title}\n\n${"Expected behavior and retained validation evidence. ".repeat(340)}`,
      status: ["backlog", "ready", "in-progress"][n % 3],
      ...(offset % 10 ? { parent: `demo-${n - (n % 10)}` } : {}),
      ...(offset > 10 && offset % 10 ? { dependsOn: [`demo-${n - 10}`] } : {}),
    };
  });
  const result = await execute("pstdio.planner.command.import-tickets", { tickets }, 20 * 60_000);
  for (let n = start; n < start + 100; n++) ids[n] = result.tickets[`demo-${n}`].id;
  evidence.ticketSeeded = ids.length;
  save();
  console.log(variant, "tickets", ids.length);
}
assert.equal(ids.length, 5000);
evidence.ticketSeedMs = performance.now() - setupStart;
await planner("ticket-status.update", { statusId: "ready", columnActions: ["archive_all"] });
writeFileSync(join(output, "ticket-ids.json"), JSON.stringify(ids));

const fixture = join(app, "__test-tmp__", "ps236-demo-foobar");
mkdirSync(fixture, { recursive: true });
copyFileSync(join(import.meta.dir, "ps236-foobar.ts"), join(fixture, "extension.ts"));
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify({
    name: "ps236-demo-foobar",
    publisher: "pstdio",
    version: "0.0.1",
    displayName: "Foobar comparison",
    main: "./extension.ts",
    type: "module",
    engines: { pstdio: "^0.5.0" },
    dependencies: { "@pstdio/sdk": "0.48.0-preview.sha-95f860c42fc872202a03183625d8b8e9179f58d9" },
  }),
);
const container = shell([
  "docker",
  "ps",
  "--filter",
  `label=com.docker.compose.project=${stack}`,
  "--format",
  "{{.ID}}",
]);
assert.ok(container && !container.includes("\n"));
const installStart = performance.now();
const installLog = shell([
  "docker",
  "exec",
  "--workdir",
  "/workspace/project",
  container,
  "/home/bun/.local/bin/pstdio",
  "extensions",
  "add",
  fixture,
  "--force",
]);
writeFileSync(join(output, "foobar-install.log"), installLog);
evidence.foobarInstallMs = performance.now() - installStart;
const foobarSeedStart = performance.now();
for (let start = 0; start < 5000; start += 100) {
  const result = await execute("pstdio.ps236-demo-foobar.command.seed", { start, count: 100 }, 20 * 60_000);
  assert.equal(result.saved, 100);
  evidence.foobarSeeded = start + 100;
  save();
}
evidence.foobarSeedMs = performance.now() - foobarSeedStart;

export {
  app,
  browserTools,
  counters,
  evidence,
  execute,
  ids,
  measure,
  origin,
  output,
  planner,
  project,
  request,
  save,
  uiOrigin,
  variant,
};
