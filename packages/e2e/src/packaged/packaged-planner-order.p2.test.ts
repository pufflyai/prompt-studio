import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { folderProjectInput } from "../helpers/folder-project";
import { createCloudAcceptanceFixture, signInCloudAcceptanceDevice } from "./packaged-cloud-acceptance.fixture";
import { stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
interface Ticket {
  id: string;
  title: string;
  position: string;
}
const owner = "pstdio.pstdio-planner";
const waitFor = async <T>(read: () => Promise<T>, matches: (value: T) => boolean) => {
  for (;;) {
    const value = await read();
    if (matches(value)) return value;
    await Bun.sleep(25);
  }
};

test(
  "packaged Planner offline moves converge and remain ordered after restarting a device",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pstdio-planner-order-"));
    const children = new Set<ChildProcess>();
    let fixture: Awaited<ReturnType<typeof createCloudAcceptanceFixture>> | undefined;
    const failures: unknown[] = [];
    try {
      fixture = await createCloudAcceptanceFixture(root, children);
      const first = await fixture.start("first");
      const project = await first.client.projects.create(
        folderProjectInput({ name: "Offline board order" }, first.folder),
      );
      await signInCloudAcceptanceDevice(first, fixture.peer.origin);
      await first.client.account.syncProject(project.id);
      const created: Ticket[] = [];
      for (const title of ["A", "B", "C", "D", "E"]) {
        created.push(await first.command<Ticket>(project.id, owner, "create-ticket", { title }));
      }
      const second = await fixture.start("second");
      await signInCloudAcceptanceDevice(second, fixture.peer.origin);
      await waitFor(
        () => second.client.projects.query(),
        ({ items }) => items.some(({ id }) => id === project.id),
      );
      await second.client.projects.chooseFolder(project.id, { path: second.folder, clone: false });
      const read = (device: typeof first) => device.command<Ticket[]>(project.id, owner, "read-tickets");
      await waitFor(
        () => read(second),
        (tickets) => tickets.length === created.length,
      );
      await fixture.peer.stop();
      await first.command(project.id, owner, "reorder-ticket", { rowId: created[3]!.id, beforeRowId: created[1]!.id });
      await second.command(project.id, owner, "reorder-ticket", { rowId: created[4]!.id, beforeRowId: created[1]!.id });
      await fixture.peer.restart();
      await Promise.all([
        first.client.account.retryProjectSync(project.id),
        second.client.account.retryProjectSync(project.id),
      ]);
      const states = await waitFor(
        () => Promise.all([read(first), read(second)]),
        ([a, b]) => JSON.stringify(a.map(({ id }) => id)) === JSON.stringify(b.map(({ id }) => id)),
      );
      const order = states[0]!.map(({ id }) => id);
      expect(order.toSorted()).toEqual(created.map(({ id }) => id).toSorted());
      for (const tickets of states) {
        expect(new Set(tickets.map(({ position }) => position)).size).toBe(created.length);
        expect(tickets.every(({ position }) => typeof position === "string")).toBe(true);
      }
      expect(order.indexOf(created[3]!.id)).toBeLessThan(order.indexOf(created[1]!.id));
      expect(order.indexOf(created[4]!.id)).toBeLessThan(order.indexOf(created[1]!.id));
      await stopProcess(first.host.child);
      const restarted = await fixture.start("first");
      expect((await read(restarted)).map(({ id }) => id)).toEqual(order);
      await restarted.command(project.id, owner, "reorder-ticket", { rowId: order.at(-1)!, beforeRowId: order[0]! });
      await waitFor(
        () => read(second),
        (tickets) => tickets[0]?.id === order.at(-1),
      );
      expect((await read(restarted)).map(({ id }) => id)).toEqual((await read(second)).map(({ id }) => id));
    } catch (cause) {
      failures.push(cause);
    }
    const stopped = await Promise.allSettled([...children].map(stopProcess));
    for (const result of stopped) if (result.status === "rejected") failures.push(result.reason);
    await fixture?.peer.close().catch((cause) => failures.push(cause));
    if (stopped.every((result) => result.status === "fulfilled"))
      await rm(root, { recursive: true, force: true }).catch((cause) => failures.push(cause));
    if (failures.length) throw new AggregateError(failures, `Planner ordering scenario or cleanup failed: ${root}`);
  },
  PACKAGED_TEST_TIMEOUT,
);
