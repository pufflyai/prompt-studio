import { afterEach, expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { createCloudAcceptanceFixture, signInCloudAcceptanceDevice } from "./packaged-cloud-acceptance.fixture";
import { stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { removeTestDirectory } from "./remove-test-directory";

setupPackagedSmokeTests();
interface Ticket {
  id: string;
  title: string;
  position: string;
}
const owner = "pstdio.planner";
const waitFor = async <T>(signal: AbortSignal, read: () => Promise<T>, matches: (value: T) => boolean) => {
  for (;;) {
    signal.throwIfAborted();
    const value = await read();
    signal.throwIfAborted();
    if (matches(value)) return value;
    await Bun.sleep(25);
  }
};

let active: { controller: AbortController; done: Promise<void>; close: () => Promise<void> } | undefined;
afterEach(async () => {
  if (!active) return;
  active.controller.abort(new Error("Planner scenario ended"));
  await active.close();
  await active.done.catch(() => {});
  active = undefined;
});

const runScenario = async (signal: AbortSignal, setClose: (close: () => Promise<void>) => void) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-planner-order-"));
  const children = new Set<ChildProcess>();
  let fixture: Awaited<ReturnType<typeof createCloudAcceptanceFixture>> | undefined;
  const failures: unknown[] = [];
  const started = performance.now();
  const phase = (name: string) => console.info(`Planner order +${Math.round(performance.now() - started)}ms: ${name}`);
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      const stopped = await Promise.allSettled([...children].map(stopProcess));
      for (const result of stopped) if (result.status === "rejected") failures.push(result.reason);
      await fixture?.peer.close().catch((cause) => failures.push(cause));
    })());
  setClose(close);
  try {
    phase("fixture setup");
    fixture = await createCloudAcceptanceFixture(root, children, { signal });
    signal.throwIfAborted();
    const first = await fixture.start("first");
    phase("first runtime ready");
    const project = await first.client.projects.create(
      folderProjectInput({ name: "Offline board order" }, first.folder),
    );
    phase("project created");
    await signInCloudAcceptanceDevice(first, fixture.peer.origin);
    await first.client.account.syncProject(project.id);
    const created: Ticket[] = [];
    for (const title of ["A", "B", "C", "D", "E"]) {
      created.push(await first.command<Ticket>(project.id, owner, "create-ticket", { title }));
    }
    phase("first device enrolled and five tickets created");
    signal.throwIfAborted();
    const second = await fixture.start("second");
    phase("second runtime ready");
    await signInCloudAcceptanceDevice(second, fixture.peer.origin);
    await waitFor(
      signal,
      () => second.client.projects.query(),
      ({ items }) => items.some(({ id }) => id === project.id),
    );
    await second.client.projects.chooseFolder(project.id, { path: second.folder, clone: false });
    phase("second project folder chosen");
    await waitFor(
      signal,
      () => second.client.account.projectSyncStatus(project.id),
      (status) => status.offlineReady,
    );
    await waitFor(
      signal,
      () => second.client.extensions.listCommands(project.id),
      ({ commands }) => commands.some(({ id }) => id === `${owner}.command.read-tickets`),
    );
    const read = (device: typeof first) => device.command<Ticket[]>(project.id, owner, "read-tickets");
    await waitFor(
      signal,
      () => read(second),
      (tickets) => tickets.length === created.length,
    );
    phase("second device offline ready with all tickets");
    await fixture.peer.stop();
    await first.command(project.id, owner, "reorder-ticket", { rowId: created[3]!.id, beforeRowId: created[1]!.id });
    await second.command(project.id, owner, "reorder-ticket", { rowId: created[4]!.id, beforeRowId: created[1]!.id });
    phase("both offline moves saved");
    await fixture.peer.restart();
    await Promise.all([
      first.client.account.retryProjectSync(project.id),
      second.client.account.retryProjectSync(project.id),
    ]);
    const states = await waitFor(
      signal,
      () => Promise.all([read(first), read(second)]),
      ([a, b]) => JSON.stringify(a.map(({ id }) => id)) === JSON.stringify(b.map(({ id }) => id)),
    );
    phase("devices converged after reconnect");
    const order = states[0]!.map(({ id }) => id);
    expect(order.toSorted()).toEqual(created.map(({ id }) => id).toSorted());
    for (const tickets of states) {
      expect(new Set(tickets.map(({ position }) => position)).size).toBe(created.length);
      expect(tickets.every(({ position }) => typeof position === "string")).toBe(true);
    }
    expect(order.indexOf(created[3]!.id)).toBeLessThan(order.indexOf(created[1]!.id));
    expect(order.indexOf(created[4]!.id)).toBeLessThan(order.indexOf(created[1]!.id));
    await stopProcess(first.host.child);
    signal.throwIfAborted();
    const restarted = await fixture.start("first");
    phase("first device restarted");
    expect((await read(restarted)).map(({ id }) => id)).toEqual(order);
    await restarted.command(project.id, owner, "reorder-ticket", { rowId: order.at(-1)!, beforeRowId: order[0]! });
    await waitFor(
      signal,
      () => read(second),
      (tickets) => tickets[0]?.id === order.at(-1),
    );
    expect((await read(restarted)).map(({ id }) => id)).toEqual((await read(second)).map(({ id }) => id));
    phase("restart move converged");
  } catch (cause) {
    failures.push(cause);
    if (fixture) {
      try {
        await writeFile(join(root, "failure-diagnostics.json"), JSON.stringify(await fixture.diagnostics(), null, 2));
      } catch (diagnosticError) {
        failures.push(diagnosticError);
      }
    }
  }
  await close();
  phase("cleanup complete");
  if (failures.length === 0) {
    try {
      await removeTestDirectory(root);
      phase("fixture files removed");
    } catch (cause) {
      failures.push(cause);
    }
  }
  if (failures.length) {
    console.error(`Planner ordering failure evidence retained at ${root}`);
    throw new AggregateError(failures, `Planner ordering scenario or cleanup failed: ${root}`);
  }
};

test(
  "packaged Planner offline moves converge and remain ordered after restarting a device",
  () => {
    const controller = new AbortController();
    const current = { controller, done: Promise.resolve(), close: async () => {} };
    active = current;
    current.done = runScenario(controller.signal, (close) => {
      current.close = close;
    });
    return current.done;
  },
  PACKAGED_TEST_TIMEOUT,
);
