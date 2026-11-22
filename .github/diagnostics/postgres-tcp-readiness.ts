import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { appendFile, chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Temporary diagnostic only. It observes the official image's temporary
// Unix-only server through its supported initialization hook.
const sourceFile = "packages/pstdio-sync-contracts/scripts/isolated.ts";
const baselineSha = process.env.BASELINE_SHA ?? "ef3ea20acd7822238367412fa0b43539c03bb367";
const fixedSha = process.env.FIXED_SHA ?? "23b9389cfa2386ea77b6601a9813a78aff712199";
const output = resolve(process.env.DIAGNOSTIC_OUTPUT ?? join(tmpdir(), "pr-2259-readiness-evidence"));
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const image = "postgres:16-alpine";
const health = {
  baseline: "pg_isready -U test -d conformance",
  fixed: "pg_isready -h 127.0.0.1 -U test -d conformance",
};
type CommandResult = { command: string[]; stdout: string; stderr: string; exitCode: number; elapsedMs: number };
type Observation = { variant: keyof typeof health; container: string; check: string; [key: string]: unknown };
const observations: Observation[] = [];
const cleanup: CommandResult[] = [];
const evidence: Record<string, unknown> = {
  diagnostic: "PR 2259: official PostgreSQL temporary initialization server readiness",
  startedAt: new Date().toISOString(), baselineSha, fixedSha, sourceFile, image,
  outcome: "incomplete", observations, cleanup,
  scope: "Deterministic readiness-signal comparison; this is not the full conformance or review gate.",
};
await mkdir(output, { recursive: true });
const save = () => writeFile(join(output, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
const run = async (args: string[]): Promise<CommandResult> => {
  const start = performance.now();
  const child = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  const result = { command: ["docker", ...args], stdout: stdout.trim(), stderr: stderr.trim(), exitCode, elapsedMs: performance.now() - start };
  await appendFile(join(output, "commands.jsonl"), JSON.stringify(result) + "\n");
  return result;
};
const must = async (args: string[]) => {
  const result = await run(args);
  assert.equal(result.exitCode, 0, `Docker ${args[0]} failed; complete output is retained in commands.jsonl`);
  return result.stdout;
};
const until = async (condition: () => Promise<boolean>, phase: string) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await Bun.sleep(50);
  }
  throw new Error(`Diagnostic phase exceeded the runner's existing 20-second health window: ${phase}`);
};
const scratch = await mkdtemp(join(tmpdir(), "pr-2259-readiness-"));
let failure: unknown;
try {
  assert.match(baselineSha, /^[a-f0-9]{40}$/);
  assert.match(fixedSha, /^[a-f0-9]{40}$/);
  // Merged PR branches can disappear. Fetch the pinned objects explicitly;
  // checkout's heads/tags fetch does not retain every refs/pull/* commit.
  git("fetch", "--no-tags", "--no-recurse-submodules", "origin", baselineSha, fixedSha);
  assert.equal(git("rev-parse", `${baselineSha}^{tree}`), "2b3a20794c337d9f6dcf5b5b3e2e679510fa9a73");
  assert.equal(git("rev-parse", `${fixedSha}^{tree}`), "02fe63039fad39208bc704afa87df747e2ae76af");
  assert.equal(git("rev-parse", `${baselineSha}:${sourceFile}`), "7476e6578dc890af5a4952cd23271a1fd0364d2f");
  assert.equal(git("rev-parse", `${fixedSha}:${sourceFile}`), "e6d10412a405dc9599f6b83ebf205731b9107be7");
  const before = git("show", `${baselineSha}:${sourceFile}`);
  const after = git("show", `${fixedSha}:${sourceFile}`);
  assert(before.includes(JSON.stringify(health.baseline)));
  assert(after.includes(JSON.stringify(health.fixed)));
  assert.equal(after.replace(health.fixed, health.baseline), before);
  assert(before.includes(`image: "${image}"`));
  assert(before.includes('interval: "1s"') && before.includes('timeout: "1s"') && before.includes("retries: 20"));
  await writeFile(join(output, "baseline-isolated.ts"), before + "\n");
  await writeFile(join(output, "fixed-isolated.ts"), after + "\n");
  evidence.sourceIdentity = {
    baselineBlob: git("rev-parse", `${baselineSha}:${sourceFile}`),
    fixedBlob: git("rev-parse", `${fixedSha}:${sourceFile}`),
    diagnosticCommit: git("rev-parse", "HEAD"),
    baselineHealth: health.baseline, fixedHealth: health.fixed,
    onlySourceDifference: "Add -h 127.0.0.1 to pg_isready",
  };
  await save();
  await must(["info", "--format", "{{.ServerVersion}}"]);
  await must(["pull", image]);
  const [identity] = JSON.parse(await must(["image", "inspect", image]));
  evidence.imageIdentity = { id: identity.Id, repoDigests: identity.RepoDigests };
  await save();
  for (const variant of ["baseline", "fixed"] as const) {
    const name = `ps2259-${variant}-${crypto.randomUUID()}`;
    const gate = join(scratch, variant);
    const init = join(gate, "init");
    await mkdir(init, { recursive: true });
    await chmod(gate, 0o777);
    await writeFile(join(init, "10-observe-readiness.sh"), "touch /diagnostic/entered\nwhile [ ! -e /diagnostic/released ]; do sleep 0.05; done\n");
    const observation: Observation = { variant, container: name, check: health[variant] };
    observations.push(observation);
    let caseFailure: unknown;
    try {
      await must(["run", "-d", "--name", name,
        "-e", "POSTGRES_DB=conformance", "-e", "POSTGRES_USER=test", "-e", "POSTGRES_PASSWORD=isolated-test-only",
        "-v", `${gate}:/diagnostic`, "-v", `${init}:/docker-entrypoint-initdb.d:ro`,
        "--health-cmd", health[variant], "--health-interval", "1s", "--health-timeout", "1s", "--health-retries", "20", identity.Id]);
      await until(() => Bun.file(join(gate, "entered")).exists(), "official temporary initialization server");
      const socketProbe = await run(["exec", name, "pg_isready", "-U", "test", "-d", "conformance"]);
      const tcpProbe = await run(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "test", "-d", "conformance"]);
      Object.assign(observation, { socketProbe, tcpProbe });
      await save();
      assert.equal(socketProbe.exitCode, 0, "The official temporary server must accept Unix-socket connections");
      assert.equal(tcpProbe.exitCode, 2, "The official temporary server must still reject TCP connections");
      if (variant === "baseline")
        await until(async () => (await must(["inspect", "--format", "{{.State.Health.Status}}", name])) === "healthy", "old false-positive health");
      else
        await until(async () => JSON.parse(await must(["inspect", "--format", "{{json .State.Health}}", name])).Log?.some((entry: { ExitCode: number }) => entry.ExitCode === 2), "fixed health probe rejects the temporary server");
      const heldHealth = JSON.parse(await must(["inspect", "--format", "{{json .State.Health}}", name]));
      observation.heldHealth = heldHealth;
      await save();
      assert.equal(heldHealth.Status, variant === "baseline" ? "healthy" : "starting");
      await writeFile(join(gate, "released"), "release\n");
      await until(async () => (await run(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "test", "-d", "conformance"])).exitCode === 0, "final TCP listener");
      await until(async () => (await must(["inspect", "--format", "{{.State.Health.Status}}", name])) === "healthy", "final healthy server");
      observation.finalTcpProbe = await run(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "test", "-d", "conformance"]);
      observation.complete = true;
      await save();
    } catch (error) {
      caseFailure = error;
      observation.error = String(error);
    } finally {
      // A failed `docker run` can still leave a created container. The UUID name
      // is owned by this case, so inspect and remove it even after startup fails.
      const inspected = await run(["inspect", name]);
      observation.cleanupInspection = inspected;
      if (inspected.exitCode === 0)
        observation.containerLogs = await run(["logs", name]);
      const removed = await run(["rm", "-fv", name]);
      cleanup.push(removed);
      const absent = /No such (container|object)/i.test(removed.stderr);
      if (removed.exitCode !== 0 && !absent) {
        observation.cleanupError = "Owned diagnostic container cleanup could not be confirmed";
        caseFailure ??= new Error(String(observation.cleanupError));
      }
      await save();
    }
    if (caseFailure) throw caseFailure;
  }
  evidence.outcome = "reproduced-and-fixed";
} catch (error) {
  failure = error;
  evidence.outcome = "failed-or-blocked";
  evidence.error = String(error);
} finally {
  await rm(scratch, { recursive: true, force: true });
  evidence.finishedAt = new Date().toISOString();
  await save();
}
console.log(JSON.stringify({ outcome: evidence.outcome, output, baselineSha, fixedSha }, null, 2));
if (failure) throw failure;
