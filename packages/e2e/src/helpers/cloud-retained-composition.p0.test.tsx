import { afterEach, beforeEach, expect, test } from "bun:test";
import { accountEvents } from "@pstdio/sdk/extensions";
import { Activity, createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { CloudContext } from "../../../../extensions/pstdio-cloud/src/cloud-context";
import { cloudStatus } from "../../../../extensions/pstdio-cloud/src/status";
import { useCloud } from "../../../../extensions/pstdio-cloud/src/use-cloud";
import { cloudAccount, cloudDevice, cloudQueryFixture } from "./cloud-retained-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const translate = () => "";
const previousActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
beforeEach(() => {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), { hidden: false }),
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
});
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
  else Reflect.deleteProperty(globalThis, "document");
  if (previousActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", previousActEnvironment);
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

const waitForCloud = async (predicate: () => boolean) => {
  const deadline = performance.now() + 1000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error("Cloud view did not reach the expected state");
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
    });
  }
};
const mountedCloud = (f: ReturnType<typeof cloudQueryFixture>) => {
  const values: ReturnType<typeof useCloud>[] = [];
  const Probe = (props: { index: number; project: string; devices: boolean }) => {
    values[props.index] = useCloud(props.project, props.devices);
    return null;
  };
  let project = "project",
    devices = false;
  const tree = (nextProject: string, nextDevices: boolean, mode: "visible" | "hidden" = "visible") =>
    createElement(
      CloudContext.Provider,
      { value: { client: f.client, t: translate } },
      createElement(
        Activity,
        { mode },
        createElement(Probe, { index: 0, project: nextProject, devices: nextDevices }),
        createElement(Probe, { index: 1, project: nextProject, devices: false }),
      ),
    );
  let root: ReactTestRenderer | undefined;
  return {
    values,
    async open() {
      await act(async () => {
        root = create(tree(project, devices));
        await turn();
      });
      await waitForCloud(() => Boolean(values[0]?.data && values[1]?.data));
    },
    async hide() {
      await act(async () => {
        root!.update(tree(project, devices, "hidden"));
      });
    },
    async resume() {
      await act(async () => {
        root!.update(tree(project, devices));
      });
      await waitForCloud(() => Boolean(values[0]?.data));
    },
    async show(nextProject: string, nextDevices: boolean) {
      project = nextProject;
      devices = nextDevices;
      await act(async () => {
        f.project(project);
        root!.update(tree(project, devices));
        await turn();
      });
      await waitForCloud(() =>
        Boolean(values[0]?.data && (!devices || values[0].data.devices.length || values[0].error)),
      );
    },
    async close() {
      await act(async () => {
        root?.unmount();
        root = undefined;
      });
    },
  };
};

test("Cloud views share account status across projects and load devices only when requested", async () => {
  const f = cloudQueryFixture();
  const mounted = mountedCloud(f);
  try {
    await mounted.open();
    expect(mounted.values[0]!.data?.account).toEqual(cloudAccount);
    expect(mounted.values[1]!.data?.sync.state).toBe("synced");
    expect(f.reads).toEqual({ status: 1, sync: 1, devices: 0 });
    await mounted.show("project", true);
    expect(mounted.values[0]!.data?.devices).toEqual([cloudDevice]);
    expect(f.reads).toEqual({ status: 1, sync: 1, devices: 1 });
    await mounted.show("second", true);
    expect(mounted.values[0]!.data?.account).toEqual(cloudAccount);
    expect(f.reads).toEqual({ status: 1, sync: 2, devices: 1 });
    await mounted.close();
    f.accountChanged();
    await turn();
    expect(f.client.queries.inspect().active).toBe(0);
    await f.account.read();
    expect(f.reads).toEqual({ status: 2, sync: 2, devices: 1 });
  } finally {
    await mounted.close();
    await f.dispose();
  }
});

test("Cloud refresh preserves accepted content, reports account failures and retries devices after recovery", async () => {
  const f = cloudQueryFixture();
  const mounted = mountedCloud(f);
  let pending: ReturnType<typeof f.holdStatus> | undefined;
  try {
    await mounted.open();
    await mounted.show("project", true);
    pending = f.holdStatus();
    await act(async () => {
      mounted.values[0]!.refresh();
      await turn();
    });
    expect(mounted.values[0]!.data?.devices).toEqual([cloudDevice]);
    await act(async () => {
      pending!.reject(new Error("Account unavailable"));
      await turn();
    });
    expect(mounted.values[0]!.data?.account).toEqual(cloudAccount);
    expect(mounted.values[0]!.data?.devices).toEqual([cloudDevice]);
    await waitForCloud(() => mounted.values[0]?.error === "Account unavailable");
    expect(mounted.values[0]!.error).toBe("Account unavailable");
    expect(f.reads.devices).toBe(1);
    f.setDevices([{ ...cloudDevice, name: "Recovered" }]);
    await act(async () => {
      mounted.values[0]!.refresh();
      await turn();
    });
    await waitForCloud(() => mounted.values[0]?.data?.devices[0]?.name === "Recovered");
    expect(mounted.values[0]!.data?.devices[0]?.name).toBe("Recovered");
    expect(mounted.values[0]!.error).toBeUndefined();
    expect(f.reads.devices).toBe(2);
  } finally {
    pending?.resolve(cloudAccount);
    await mounted.close();
    await f.dispose();
  }
});

test("incomplete downloads publish without waiting for irrelevant project preparation", async () => {
  const f = cloudQueryFixture();
  f.setSync({ state: "first-download-incomplete", offlineReady: false });
  const pending = f.holdProject();
  const mounted = mountedCloud(f);
  try {
    await mounted.open();
    expect(mounted.values[0]!.data?.sync).toEqual({ state: "first-download-incomplete", offlineReady: false });
    expect(f.projectReads).toBe(0);
    await act(async () => {
      f.setSync({ state: "synced", offlineReady: true });
      f.emit(accountEvents.projectSyncChanged.id, "project");
      await turn();
    });
    await waitForCloud(() => f.projectReads === 1 && mounted.values[0]?.data?.sync.state === "synced");
    expect(f.projectReads).toBe(1);
    expect(mounted.values[0]!.data?.sync).toEqual({ state: "synced", offlineReady: true });
    const preparing = mounted.values[0]!.data!;
    expect(cloudStatus(preparing.account, preparing.sync, preparing.project).key).toBe("preparing");
    await act(async () => {
      pending.resolve({ state: "preparing" });
      await turn();
    });
    await waitForCloud(
      () =>
        mounted.values[0]?.data?.project?.state === "preparing" &&
        mounted.values[1]?.data?.project?.state === "preparing",
    );
    expect(mounted.values[0]!.data?.project).toEqual({ state: "preparing" });
    expect(mounted.values[1]!.data?.project).toEqual({ state: "preparing" });
    expect(f.projectReads).toBe(1);
  } finally {
    pending.resolve({ state: "preparing" });
    await mounted.close();
    await f.dispose();
  }
});

test("connectivity changes update Cloud status without rereading shared data", async () => {
  const f = cloudQueryFixture();
  const mounted = mountedCloud(f);
  try {
    await mounted.open();
    const reads = { ...f.reads };
    const projectReads = f.projectReads;
    await act(async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      window.dispatchEvent(new Event("offline"));
    });
    expect(mounted.values[0]!.online).toBe(false);
    expect(mounted.values[0]!.data?.sync.state).toBe("offline");
    await act(async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
    });
    expect(mounted.values[0]!.online).toBe(true);
    expect(mounted.values[0]!.data?.sync.state).toBe("synced");
    expect(f.reads).toEqual(reads);
    expect(f.projectReads).toBe(projectReads);
  } finally {
    await mounted.close();
    await f.dispose();
  }
});

test("a failed initial project preparation read reports attention without leaving preparation active", async () => {
  const f = cloudQueryFixture();
  const pending = f.holdProject();
  const mounted = mountedCloud(f);
  try {
    await mounted.open();
    await act(async () => {
      pending.reject(new Error("Project preparation unavailable"));
      await turn();
    });
    const failed = mounted.values[0]!;
    expect(failed.error).toBe("Project preparation unavailable");
    expect(failed.data?.account).toEqual(cloudAccount);
    const data = failed.data!;
    expect(cloudStatus(data.account, data.sync, data.project).active ?? false).toBe(false);
  } finally {
    pending.resolve({ state: "ready" });
    await mounted.close();
    await f.dispose();
  }
});

test("a captured Cloud Retry cannot borrow the next Activity lifetime after hide and return", async () => {
  const f = cloudQueryFixture();
  const mounted = mountedCloud(f);
  try {
    await mounted.open();
    const oldRefresh = mounted.values[0]!.refresh;
    await mounted.hide();
    await mounted.resume();
    const before = { ...f.reads };
    await act(async () => {
      oldRefresh();
      await turn();
    });
    expect(f.reads).toEqual(before);
    await act(async () => {
      mounted.values[0]!.refresh();
      await turn();
    });
    await waitForCloud(() => f.reads.status === before.status + 1 && f.reads.sync === before.sync + 1);
    expect(f.reads.devices).toBe(0);
  } finally {
    await mounted.close();
    await f.dispose();
  }
});
