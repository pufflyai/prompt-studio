import { expect, test } from "bun:test";
import { createWebviewClient, viewDataEvents } from "@pstdio/sdk/extensions";
import { type commands, createHomeQueries } from "pstdio-home/testing";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = () => {
  const reads = { home: 0, recent: 0 };
  let failed = false;
  let name = "Selected";
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-home",
    execute: async (command) => {
      const kind = command.commandId.endsWith(".command.read") ? "home" : "recent";
      reads[kind]++;
      if (failed) throw Error("Disconnected");
      return kind === "home" ? { project: { name }, setupError: null } : [];
    },
  });
  const frame = transport.frame();
  const client = createWebviewClient<typeof commands>(frame.host);
  const queries = createHomeQueries(client);
  return {
    ...queries,
    reads,
    root: transport.queries,
    listeners: frame.listeners,
    fail: (next: boolean) => {
      failed = next;
    },
    rename: (next: string) => {
      name = next;
    },
    emit: (projectId: string, id = viewDataEvents.workspacesChanged.id) => transport.emit(id, projectId),
    observe: () => {
      const stops = [queries.home.subscribe(() => {}), queries.recent.subscribe(() => {})];
      return () => {
        for (const stop of stops) stop();
      };
    },
    dispose: () => {
      client.queries.dispose();
      frame.dispose();
      transport.dispose();
    },
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
  f.dispose();
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
  f.dispose();
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
  void f.home.refresh();
  void f.recent.refresh();
  await turn();
  expect(f.home.getSnapshot().error).toBeUndefined();
  expect(f.reads).toEqual({ home: 3, recent: 3 });
  stop();
  f.dispose();
  expect(f.home.getSnapshot().data).toBeUndefined();
});
