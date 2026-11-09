import { expect, test } from "bun:test";
import { createWebviewQueryClient, type GuestHost, viewDataEvents } from "@pstdio/sdk/extensions";
import { createHomeQueries } from "./home-queries";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = () => {
  const listeners = new Set<(event: unknown) => void>();
  const reads = { home: 0, recent: 0 };
  let failed = false;
  let name = "Selected";
  const host = {
    extensionId: "pstdio.pstdio-home",
    propsStore: { get: () => ({ projectId: "selected" }), subscribe: () => () => {} },
    onEvent: (_scope: string, listener: (event: unknown) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    call: async (_method: string, input: { commandId: string }) => {
      const kind = input.commandId.endsWith(".command.read") ? "home" : "recent";
      reads[kind]++;
      if (failed) throw new Error("Disconnected");
      const value = kind === "home" ? { project: { name }, setupError: null } : [];
      return { outcome: { ok: true, status: "success", value } };
    },
  } as unknown as GuestHost;
  const queries = createHomeQueries(host, "selected");
  return {
    ...queries,
    reads,
    root: createWebviewQueryClient(host),
    emit: (projectId: string, id = viewDataEvents.workspacesChanged.id) => {
      for (const listener of listeners) listener({ type: "changed", id, projectId });
    },
    fail: (next: boolean) => {
      failed = next;
    },
    rename: (next: string) => {
      name = next;
    },
    observe: () => {
      const stops = [queries.home.subscribe(() => {}), queries.recent.subscribe(() => {})];
      return () => {
        for (const stop of stops) stop();
      };
    },
    listeners,
  };
};

test("Home shares scoped reads, keeps unchanged returns warm and catches up only affected project data", async () => {
  const f = fixture();
  let stop = f.observe();
  await turn();
  expect(f.reads).toEqual({ home: 1, recent: 1 });
  f.emit("other");
  await turn();
  expect(f.reads).toEqual({ home: 1, recent: 1 });
  f.emit("selected", viewDataEvents.sessionsChanged.id);
  await turn();
  expect(f.reads).toEqual({ home: 1, recent: 2 });
  stop();
  stop = f.observe();
  await turn();
  expect(f.reads).toEqual({ home: 1, recent: 2 });
  stop();
  f.emit("selected");
  await turn();
  expect(f.reads).toEqual({ home: 1, recent: 2 });
  expect(f.root.inspect()).toEqual({ active: 0, retained: 2 });
  stop = f.observe();
  expect(f.home.getSnapshot().data?.project.name).toBe("Selected");
  await turn();
  expect(f.reads).toEqual({ home: 2, recent: 3 });
  stop();
  f.root.dispose();
  expect(f.listeners.size).toBe(0);
});

test("renaming the selected project refreshes its Home header without another project's metadata leaking in", async () => {
  const f = fixture();
  const stop = f.observe();
  await turn();
  f.rename("Renamed project");
  f.emit("other", "view.projects.changed");
  await turn();
  expect(f.home.getSnapshot().data?.project.name).toBe("Selected");
  f.emit("selected", "view.projects.changed");
  await turn();
  expect(f.home.getSnapshot().data?.project.name).toBe("Renamed project");
  expect(f.reads).toEqual({ home: 2, recent: 1 });
  stop();
  f.root.dispose();
});

test("a failed Home refresh retains loaded data and an explicit retry recovers without another cache", async () => {
  const f = fixture();
  const stop = f.observe();
  await turn();
  f.fail(true);
  f.emit("selected");
  await turn();
  expect(f.home.getSnapshot().data?.project.name).toBe("Selected");
  expect(f.home.getSnapshot().error?.message).toBe("Disconnected");
  f.fail(false);
  f.home.invalidate();
  f.recent.invalidate();
  await turn();
  expect(f.home.getSnapshot().error).toBeUndefined();
  expect(f.reads).toEqual({ home: 3, recent: 3 });
  stop();
  f.root.dispose();
  expect(f.home.getSnapshot().data).toBeUndefined();
});
