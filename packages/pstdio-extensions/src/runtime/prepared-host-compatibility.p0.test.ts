import { afterEach, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { PreparedHostObservation } from "./prepared-host.fixture";

const roots: string[] = [];
const children = new Set<ReturnType<typeof Bun.spawn>>();
afterEach(async () => {
  for (const child of children) child.kill();
  await Promise.all([...children].map((child) => child.exited));
  children.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const observeHost = async (executable: string, home: string, source: string, scenario: string) => {
  const child = Bun.spawn([executable, join(import.meta.dir, "prepared-host.fixture.ts"), source], {
    env: { ...process.env, PSTDIO_HOME: home },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  children.add(child);
  const [capture, live] = child.stdout.tee();
  // Preserve an outstanding phase start even when a child never reaches its final record.
  const forwarding = live.pipeTo(
    new WritableStream({
      write: (chunk) => {
        process.stdout.write(chunk);
      },
    }),
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(capture).text(),
    new Response(child.stderr).text(),
    child.exited,
    forwarding,
  ]);
  children.delete(child);
  const record = stdout.split("\n").find((line) => line.startsWith("PSTDIO_PREPARED_HOST_OBSERVATION "));
  expect(exitCode, `${stderr}\n${stdout}`).toBe(0);
  expect(record, stdout).toBeDefined();
  const observation = JSON.parse(record!.slice("PSTDIO_PREPARED_HOST_OBSERVATION ".length)) as PreparedHostObservation;
  console.log(JSON.stringify({ scenario, ...observation }));
  expect(observation.error).toBeUndefined();
  expect(observation.value).toBe("prepared-value");
  expect(observation.phases.map(({ state }) => state)).toEqual(Array(6).fill("completed"));
  return observation;
};

test("a restarted host reuses prepared bundles but a replaced executable rejects their acceptance", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-host-compatibility-"));
  roots.push(root);
  const source = join(root, "source");
  const home = join(root, "home");
  const hostDirectory = join(root, "host");
  mkdirSync(source);
  mkdirSync(hostDirectory);
  const executable = join(hostDirectory, process.platform === "win32" ? "bun.exe" : "bun");
  // Change only a disposable executable's build stamp, never the running test binary.
  copyFileSync(process.execPath, executable);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "prepared-host-compatibility",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    'export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => "prepared-value" }] };',
  );

  const first = await observeHost(executable, home, source, "cold-host");
  expect(first.acceptedBefore).toBeNull();
  const restarted = await observeHost(executable, home, source, "same-build-restart");
  expect(restarted.acceptedBefore?.id).toBe(first.prepared!.id);
  expect(restarted.prepared).toEqual(first.prepared);
  expect(restarted.artifact).toEqual(first.artifact);

  const stamp = statSync(executable);
  utimesSync(executable, stamp.atime, new Date(stamp.mtimeMs + 2000));
  const replaced = await observeHost(executable, home, source, "replaced-host-build");
  expect(replaced.host.executable).toBe(first.host.executable);
  expect(replaced.host.executableMtimeMs).not.toBe(first.host.executableMtimeMs);
  expect(replaced.host.bunVersion).toBe(first.host.bunVersion);
  expect(replaced.host.bunRevision).toBe(first.host.bunRevision);
  // The warm acceptance fast path must reject output compiled by a different host build.
  expect(replaced.acceptedBefore).toBeNull();
  expect(replaced.prepared!.id).not.toBe(first.prepared!.id);
  expect(replaced.prepared!.entryPath).not.toBe(first.prepared!.entryPath);
});
