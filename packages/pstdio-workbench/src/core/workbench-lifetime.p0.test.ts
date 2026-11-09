import { expect, spyOn, test } from "bun:test";
import { createMemoryWorkbenchPageLocationBrowser } from "./controllers/page-location/page-location-memory";
import { createWorkbench } from "./workbench-core";

test("disposing a workbench releases modules, initialized and entered modes, and standalone placements once", async () => {
  const core = createWorkbench();
  const released: string[] = [];
  const release = (name: string) => ({ dispose: () => void released.push(name) });
  core.registerModule({
    id: "project",
    activate(context) {
      context.registerChildModule({ id: "child", activate: () => release("child") });
      context.commands.registerCommand({ id: "project.read", label: "Read" }, { execute: () => null });
      return release("project");
    },
  });
  core.modes.registerMode({
    id: "mode",
    activate: () => release("activate"),
    enter: () => release("enter"),
  });
  core.modes.setActiveMode("mode");
  core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
  core.shellPlacements.registerPlacement({
    id: "shell",
    region: "secondary",
    item: { kind: "view", presence: "closed", view: { kind: "view", id: "view" } },
  });
  await Promise.all([core.dispose(), core.dispose()]);
  expect(released.sort()).toEqual(["activate", "child", "enter", "project"]);
  expect(core.commands.getCommand("project.read")).toBeUndefined();
  expect(core.modes.listModes()).toEqual([]);
  expect(core.shellPlacements.listPlacements()).toEqual([]);
  expect(() => core.registerModule({ id: "late", activate: () => undefined })).toThrow("disposed");
  expect(() => core.modes.registerMode({ id: "late", activate: () => undefined })).toThrow("disposed");
});

test("disposed workbench stores reject new observation and stop existing UI observation", async () => {
  const core = createWorkbench();
  let notices = 0;
  core.focus.store.subscribe(() => notices++);
  await core.dispose();
  core.focus.store.subscribe(() => notices++);
  core.focus.setActiveRegion("main");
  expect(notices).toBe(0);
});

test("module teardown cannot replace the saved layout after persistence has closed", async () => {
  let closed = false;
  let lateWrites = 0;
  const core = createWorkbench({
    layoutPersistence: {
      getLayout: () => undefined,
      setLayout: () => {
        if (closed) lateWrites++;
      },
      dispose: () => {
        closed = true;
      },
    },
  });
  core.registerModule({
    id: "project",
    activate(context) {
      context.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
      context.shellPlacements.registerPlacement({
        id: "shell",
        region: "secondary",
        item: { kind: "view", presence: "closed", view: { kind: "view", id: "view" } },
      });
    },
  });
  core.shellPlacements.openPlacement({ placementId: "shell" });
  await core.dispose();
  core.layout.setRegionVisible("secondary", false);
  expect(closed).toBe(true);
  expect(lateWrites).toBe(0);
});

test("disposal closes module and mode admission synchronously", async () => {
  const core = createWorkbench();
  const pending = core.dispose();
  expect(() => core.registerModule({ id: "late", activate: () => undefined })).toThrow("disposed");
  expect(() => core.modes.registerMode({ id: "late", activate: () => undefined })).toThrow("disposed");
  await pending;
});

test("a failing external disposer cannot skip the remaining workbench owners", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  let modules = 0;
  let persistence = 0;
  const core = createWorkbench({
    pageLocationBrowser: {
      ...browser,
      onPopState: () => ({
        dispose: () => {
          throw new Error("external disposal failed");
        },
      }),
    },
    layoutPersistence: {
      getLayout: () => undefined,
      setLayout: () => {},
      dispose: () => {
        persistence++;
      },
    },
  });
  core.registerModule({
    id: "module",
    activate: () => ({
      dispose: () => {
        modules++;
      },
    }),
  });
  core.modes.registerMode({ id: "mode", activate: () => undefined });
  await core.dispose().catch(() => {});
  expect(modules).toBe(1);
  expect(persistence).toBe(1);
  expect(core.modes.listModes()).toEqual([]);
});

test("accepted preference writes finish before their module-owned adapter resources close", async () => {
  const core = createWorkbench();
  const gate = Promise.withResolvers<void>();
  let resourceClosed = false;
  let value = 0;
  core.registerModule({
    id: "settings",
    activate(context) {
      context.preferences.registerSchema({ properties: { size: { type: "number", scope: "user" } } });
      context.preferences.registerValueAdapter("size", {
        get: () => value,
        async set(next) {
          await gate.promise;
          if (resourceClosed) throw new Error("adapter resource already closed");
          value = Number(next);
        },
      });
      return {
        dispose: () => {
          resourceClosed = true;
        },
      };
    },
  });
  const first = core.preferences.setValue("size", 1, { scope: "user" });
  const second = core.preferences.setValue("size", 2, { scope: "user" });
  const outcomes = Promise.allSettled([first, second]);
  const disposal = core.dispose();
  await Bun.sleep(0);
  try {
    expect(resourceClosed).toBe(false);
  } finally {
    gate.resolve();
    await disposal;
  }
  expect((await outcomes).map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
  expect(value).toBe(2);
  expect(resourceClosed).toBe(true);
});

test("shutdown reports an older pending preference failure even when its queued successor succeeds", async () => {
  const gate = Promise.withResolvers<void>();
  let accepted = 0;
  const core = createWorkbench({
    preferencePersistence: {
      getValue: () => accepted,
      async setValue(_name, value) {
        await gate.promise;
        if (value === 1) throw new Error("first write failed");
        accepted = Number(value);
      },
    },
  });
  core.preferences.registerSchema({ properties: { size: { type: "number", scope: "user" } } });
  const outcomes = Promise.allSettled([
    core.preferences.setValue("size", 1, { scope: "user" }),
    core.preferences.setValue("size", 2, { scope: "user" }),
  ]);
  const closed = core.dispose().then(
    () => undefined,
    (error: Error) => error,
  );
  gate.resolve();
  expect((await outcomes).map((result) => result.status)).toEqual(["rejected", "fulfilled"]);
  expect((await closed)?.message).toBe("first write failed");
  expect(accepted).toBe(2);
});

test("a failed layout flush still closes persistence and reports its failure after cleanup", async () => {
  let released = 0;
  const core = createWorkbench({
    layoutPersistence: {
      getLayout: () => undefined,
      setLayout: () => {},
      flush: () => {
        throw new Error("flush failed");
      },
      dispose: () => {
        released++;
      },
    },
  });
  const error = await core.dispose().then(
    () => undefined,
    (error: Error) => error,
  );
  expect(released).toBe(1);
  expect(error?.message).toBe("flush failed");
});

test("normal contribution teardown stops page reconciliation before modes close", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  const core = createWorkbench();
  core.registerModule({
    id: "project",
    activate(context) {
      context.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
      context.shellPlacements.registerPlacement({
        id: "shell",
        region: "secondary",
        item: { kind: "view", presence: "closed", view: { kind: "view", id: "view" } },
      });
    },
  });
  try {
    await core.dispose();
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
  }
});

test("terminal admission closes while required preferences still hold workbench disposal", async () => {
  const write = Promise.withResolvers<void>();
  const core = createWorkbench({ preferencePersistence: { getValue: () => 0, setValue: () => write.promise } });
  core.preferences.registerSchema({ properties: { size: { type: "number", scope: "user" } } });
  const opening =
    Promise.withResolvers<import("./controllers/terminal/terminal-controller").WorkbenchTerminalSessionAdapter>();
  let signal!: AbortSignal;
  let killed = 0;
  core.terminal.setSessionOpener((_request, _view, input) => {
    signal = input!;
    return opening.promise;
  });
  const admitted = core.terminal.open({ request: { cols: 80, rows: 24 } }).catch((error) => error);
  const save = core.preferences.setValue("size", 1, { scope: "user" });
  const disposal = core.dispose();
  expect(core.terminal.isAvailable()).toBe(false);
  expect(signal.aborted).toBe(true);
  await expect(core.terminal.open({ request: { cols: 80, rows: 24 } })).rejects.toThrow("not available");
  opening.resolve({
    id: "late",
    write() {},
    resize() {},
    kill() {
      killed++;
    },
    onData: () => () => {},
    onExit: () => () => {},
    onError: () => () => {},
  });
  await admitted;
  expect(killed).toBe(1);
  write.resolve();
  await Promise.all([save, disposal]);
});

test("external teardown cannot reenter terminal admission", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  let core!: ReturnType<typeof createWorkbench>;
  let available: boolean | undefined;
  let opening: Promise<unknown> | undefined;
  let opens = 0;
  core = createWorkbench({
    pageLocationBrowser: {
      ...browser,
      onPopState: () => ({
        dispose() {
          available = core.terminal.isAvailable();
          opening = core.terminal.open({ request: { cols: 80, rows: 24 } }).catch((error) => error);
        },
      }),
    },
  });
  core.terminal.setSessionOpener(async () => {
    opens++;
    throw new Error("should not open");
  });
  await core.dispose();
  expect(available).toBe(false);
  expect(opens).toBe(0);
  expect(await opening).toBeInstanceOf(Error);
});

test("terminal teardown cannot admit another required owner or preference write", async () => {
  const { registerWorkbenchRequiredWork } = await import("./workbench-required-work");
  let lateOwners = 0;
  let latePreferences = 0;
  const core = createWorkbench({
    preferencePersistence: {
      getValue: () => 0,
      setValue: () => {
        latePreferences++;
      },
    },
  });
  core.preferences.registerSchema({ properties: { size: { type: "number", scope: "user" } } });
  core.terminal.setSessionOpener(async () => ({
    id: "terminal",
    write() {},
    resize() {},
    onData: () => () => {},
    onExit: () => () => {},
    onError: () => () => {},
    kill() {
      try {
        registerWorkbenchRequiredWork(core, () => {
          lateOwners++;
        });
      } catch {}
      try {
        core.preferences.setValue("size", 1, { scope: "user" });
      } catch {}
    },
  }));
  await core.terminal.open({ request: { cols: 80, rows: 24 } });
  await core.dispose();
  expect(lateOwners).toBe(0);
  expect(latePreferences).toBe(0);
});
