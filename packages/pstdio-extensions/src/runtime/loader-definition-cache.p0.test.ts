import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { runtimeOperationChannel } from "pstdio-diagnostics";
import { expectRejection } from "../test-utils/expect-rejection";
import type { ExtensionDiagnostic } from "../types/runtime";
import {
  closeBackendWorkers,
  loadBackendDefinition,
  readBackendDefinitionReadCount,
  restartBackendWorker,
} from "./backend-process/backend-workers";
import { definitionCachePath } from "./backend-process/definition-cache";
import { loadExtensionPackage } from "./loader";
import { stopExtensionPreparation } from "./preparation-client";

let root: string;
let previousHome: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "loader-definition-cache-"));
  previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
});

afterEach(async () => {
  await closeBackendWorkers();
  await stopExtensionPreparation();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  rmSync(root, { recursive: true, force: true });
});

const evaluationsLog = () => join(root, "evaluations.log");
const evaluations = () => (existsSync(evaluationsLog()) ? readFileSync(evaluationsLog(), "utf8").length : 0);

// Every evaluation of the entry, in any worker, appends one character to the log.
const writeExtension = (body: string, name = "cached") => {
  const dir = join(root, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(dir, "extension.ts"),
    `import { appendFileSync } from "node:fs";
     appendFileSync(${JSON.stringify(evaluationsLog())}, "x");
     ${body}`,
  );
  return dir;
};

const commandSource = (title: string) =>
  `export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: ${JSON.stringify(title)}, run: () => ${JSON.stringify(title)} }] };`;

const load = async (dir: string) => {
  const diagnostics: ExtensionDiagnostic[] = [];
  const loaded = await loadExtensionPackage({ path: dir }, diagnostics);
  expect(diagnostics).toEqual([]);
  return loaded!;
};

const run = (loaded: Awaited<ReturnType<typeof load>>) =>
  (loaded.definition.commands as unknown as Array<{ run: (...args: unknown[]) => Promise<unknown> }>)[0]!.run({}, {});

test("a cached definition loads without evaluating the entry until a handler runs", async () => {
  const dir = writeExtension(commandSource("first"));
  const first = await load(dir);
  expect(evaluations()).toBe(1);
  const reads = readBackendDefinitionReadCount();

  const again = await load(dir);
  expect(readBackendDefinitionReadCount()).toBe(reads);
  expect(evaluations()).toBe(1);
  expect((again.definition.commands as unknown as Array<{ title: string }>)[0]!.title).toBe("first");
  expect(again.preparedRevision?.id).toBe(first.preparedRevision?.id);

  expect(await run(again)).toBe("first");
  expect(evaluations()).toBe(2);
});

test("a cold host start with a warm cache starts no worker", async () => {
  const dir = writeExtension(commandSource("warm"));
  const script = join(root, "host.ts");
  writeFileSync(
    script,
    `import { loadExtensionPackage } from ${JSON.stringify(join(import.meta.dir, "loader.ts"))};
     import { stopExtensionPreparation } from ${JSON.stringify(join(import.meta.dir, "preparation-client.ts"))};
     const diagnostics = [];
     const loaded = await loadExtensionPackage({ path: process.argv[2] }, diagnostics);
     await stopExtensionPreparation();
     console.log(JSON.stringify({ diagnostics, title: loaded.definition.commands[0].title }));`,
  );
  const start = () => {
    const result = Bun.spawnSync([process.execPath, script, dir], { env: { ...process.env } });
    expect(result.exitCode).toBe(0);
    return JSON.parse(result.stdout.toString()) as { diagnostics: unknown[]; title: string };
  };
  expect(start()).toEqual({ diagnostics: [], title: "warm" });
  expect(evaluations()).toBe(1);
  expect(start()).toEqual({ diagnostics: [], title: "warm" });
  expect(evaluations()).toBe(1);
});

test("an unreadable or foreign cache entry is read again from a worker", async () => {
  const dir = writeExtension(commandSource("own"));
  const loaded = await load(dir);
  const path = definitionCachePath(loaded.preparedRevision!.id);
  writeFileSync(path, "not a definition");
  expect((await load(dir)).definition.commands).toHaveLength(1);
  expect(evaluations()).toBe(2);

  // An entry written for another revision never answers for this one.
  const other = await load(writeExtension(commandSource("other"), "other"));
  writeFileSync(path, readFileSync(definitionCachePath(other.preparedRevision!.id)));
  const reread = await load(dir);
  expect((reread.definition.commands as unknown as Array<{ title: string }>)[0]!.title).toBe("own");
  expect(evaluations()).toBe(4);
  expect((await load(dir)).definition.commands).toHaveLength(1);
  expect(evaluations()).toBe(4);
});

test("a changed source generation is read again and runs its own code", async () => {
  const dir = writeExtension(commandSource("before"));
  const before = await load(dir);
  expect(await run(before)).toBe("before");
  expect(evaluations()).toBe(2);

  writeFileSync(
    join(dir, "extension.ts"),
    readFileSync(join(dir, "extension.ts"), "utf8").replace(commandSource("before"), commandSource("after")),
  );
  const after = await load(dir);
  expect(after.preparedRevision?.id).not.toBe(before.preparedRevision?.id);
  expect((after.definition.commands as unknown as Array<{ title: string }>)[0]!.title).toBe("after");
  expect(await run(after)).toBe("after");
  expect(existsSync(definitionCachePath(before.preparedRevision!.id))).toBe(true);
});

test("a data-only extension loads its contributions from the cache", async () => {
  const dir = writeExtension(
    `export default { themes: [{ id: "dusk", label: "Dusk", mode: "dark", variables: { "--surface": "#000" } }], skills: [] };`,
  );
  const first = await load(dir);
  const again = await load(dir);
  expect(again.definition).toEqual(first.definition);
  expect((again.definition.themes as unknown as Array<{ id: string }>)[0]!.id).toBe("dusk");
  expect(evaluations()).toBe(1);
});

test("an entry whose handlers move between evaluations is refused and read again on the next load", async () => {
  // The first evaluation exports one command, later ones two, so handler ids no longer line up.
  const dir = writeExtension(
    `import { readFileSync } from "node:fs";
     const count = readFileSync(${JSON.stringify(evaluationsLog())}, "utf8").length;
     const command = (id) => ({ id, ref: { kind: "command", id }, title: id, run: () => id });
     export default { commands: count === 1 ? [command("one")] : [command("zero"), command("one")] };`,
  );
  const loaded = await load(dir);
  const error = await run(loaded).catch((caught: unknown) => caught);
  expect((error as { code?: string }).code).toBe("backend_unavailable");
  expect(existsSync(definitionCachePath(loaded.preparedRevision!.id))).toBe(false);
  expect((await load(dir)).definition.commands).toHaveLength(2);
});

test("an entry that swaps a handler for another in the same position is refused", async () => {
  // The first evaluation exports "one", later ones "two" where "one" was: handler ids line up.
  const dir = writeExtension(
    `import { readFileSync } from "node:fs";
     const id = readFileSync(${JSON.stringify(evaluationsLog())}, "utf8").length === 1 ? "one" : "two";
     export default { commands: [{ id, ref: { kind: "command", id }, title: id, run: () => id }] };`,
  );
  const loaded = await load(dir);
  expect((loaded.definition.commands as unknown as Array<{ id: string }>)[0]!.id).toBe("one");
  await expectRejection(run(loaded)).toMatchObject({ code: "backend_unavailable" });
  expect(existsSync(definitionCachePath(loaded.preparedRevision!.id))).toBe(false);
});

test("restarting a folder's worker gives its next call fresh module state", async () => {
  const dir = writeExtension(
    `let calls = 0;
     export default { commands: [{ id: "count", ref: { kind: "command", id: "count" }, title: "Count", run: () => ++calls }] };`,
  );
  const loaded = await load(dir);
  expect(await run(loaded)).toBe(1);
  expect(await run(loaded)).toBe(2);
  await restartBackendWorker(dir, loaded.preparedRevision!);
  expect(await run(loaded)).toBe(1);
});

test("concurrent cold loads of one revision share one definition read", async () => {
  // The entry stays in evaluation long enough for both loads to miss the cache together.
  const dir = writeExtension(`await Bun.sleep(300);\n${commandSource("shared")}`);
  const reads = readBackendDefinitionReadCount();
  const [first, second] = await Promise.all([load(dir), load(dir)]);
  expect(first.preparedRevision?.id).toBe(second.preparedRevision?.id);
  expect(readBackendDefinitionReadCount() - reads).toBe(1);
  expect(evaluations()).toBe(1);
});

test("a failed definition read is recorded as a failed runtime operation", async () => {
  const operations: Array<Record<string, unknown>> = [];
  const record = (message: unknown) => operations.push(message as Record<string, unknown>);
  subscribe(runtimeOperationChannel, record);
  try {
    const dir = writeExtension(`throw new Error("Entry failed");`);
    const diagnostics: ExtensionDiagnostic[] = [];
    await loadExtensionPackage({ path: dir }, diagnostics);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["extension_import_failed"]);
    await load(writeExtension(commandSource("read"), "healthy"));
  } finally {
    unsubscribe(runtimeOperationChannel, record);
  }
  const reads = operations.filter((operation) => operation.kind === "extension.backend.definition");
  expect(reads.map((operation) => operation.failed)).toEqual([true, false]);
});

const pidSource = (title: string) =>
  `export default { commands: [{ id: "check", ref: { kind: "command", id: "check" }, title: ${JSON.stringify(title)}, run: () => process.pid }] };`;

test("loading a changed source that is never used leaves the running worker alone", async () => {
  const dir = writeExtension(pidSource("before"));
  const before = await load(dir);
  const pid = await run(before);
  // A candidate the host may still reject, such as one with conflicting resource prefixes.
  writeFileSync(
    join(dir, "extension.ts"),
    readFileSync(join(dir, "extension.ts"), "utf8").replace(pidSource("before"), pidSource("candidate")),
  );
  const candidate = await load(dir);
  expect(candidate.preparedRevision?.id).not.toBe(before.preparedRevision?.id);
  expect(await run(before)).toBe(pid);
  // Using the new generation replaces the old worker.
  expect(await run(candidate)).not.toBe(pid);
});

test("concurrent calls wait for the old worker to stop before starting its replacement", async () => {
  const dir = writeExtension(pidSource("before"));
  const before = await load(dir);
  const previous = await (await loadBackendDefinition(dir, before.preparedRevision!)).acquire();
  writeFileSync(join(dir, "extension.ts"), pidSource("replacement"));
  const replacement = await load(dir);

  const stopping = Promise.withResolvers<void>();
  const finishStop = Promise.withResolvers<void>();
  const stop = previous.stop;
  const delayStop = spyOn(previous, "stop").mockImplementation(async () => {
    stopping.resolve();
    await finishStop.promise;
    await stop();
  });
  try {
    const first = run(replacement);
    await stopping.promise;
    const spawn = spyOn(Bun, "spawn");
    const second = run(replacement);
    await Bun.sleep(0);
    const startedWhileStopping = spawn.mock.calls.length;
    spawn.mockRestore();
    finishStop.resolve();
    const [firstPid, secondPid] = await Promise.all([first, second]);
    expect(firstPid).toBe(secondPid);
    expect(startedWhileStopping).toBe(0);
  } finally {
    finishStop.resolve();
    delayStop.mockRestore();
  }
});

test("an unused candidate does not interrupt adoption of the active replacement", async () => {
  const dir = writeExtension(pidSource("before"));
  const before = await load(dir);
  const previous = await (await loadBackendDefinition(dir, before.preparedRevision!)).acquire();
  expect(await run(before)).toBeNumber();

  writeFileSync(join(dir, "extension.ts"), pidSource("replacement"));
  const replacement = await load(dir);
  writeFileSync(join(dir, "extension.ts"), pidSource("unused candidate"));
  await load(dir);

  let exited = false;
  void previous.exited.then(() => {
    exited = true;
  });
  const [first, second] = await Promise.all([run(replacement), run(replacement)]);
  expect(first).toBe(second);
  expect(exited).toBe(true);
  await expectRejection(run(before)).toThrow("retired");
});

test("a handler loaded before backends shut down starts no worker afterwards", async () => {
  const loaded = await load(writeExtension(pidSource("before")));
  await closeBackendWorkers();
  await expectRejection(run(loaded)).toThrow("shut down");
});
