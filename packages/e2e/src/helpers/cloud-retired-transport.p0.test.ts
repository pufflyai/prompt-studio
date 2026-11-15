import { expect, test } from "bun:test";
import { cloudAccount, cloudQueryFixture } from "./cloud-retained-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("a returning Cloud view receives current status while a retired completed bridge read is held", async () => {
  const f = cloudQueryFixture();
  const abort = new AbortController();
  let reply: ReturnType<typeof f.holdReply> | undefined;
  try {
    await f.open();
    const query = f.queries.account;
    reply = f.holdReply((method, input) => method === "account.read" && input.query?.operation === "refresh");
    const old = query.refresh(abort.signal);
    await reply.entered;
    f.detach();
    abort.abort(new Error("old view left"));
    await expect(old).rejects.toThrow("old view left");
    const current = { ...cloudAccount, cloudProjects: ["project", "newer"] };
    f.setAccount(current);
    f.accountChanged();
    await f.account.read();
    const reads = f.reads.status;
    f.observe(query);
    expect(query.getSnapshot().data).toEqual(current);
    expect(f.reads.status).toBe(reads);
    reply.release();
    await turn();
    expect(query.getSnapshot().data).toEqual(current);
    expect(f.maxLive.status).toBe(1);
    expect(f.account.inspect().automaticObservers).toBeGreaterThanOrEqual(1);
  } finally {
    abort.abort();
    reply?.release();
    await f.dispose();
  }
});

test("a retired Cloud bridge completion cannot release the newer pending read or consume its queued refresh", async () => {
  const f = cloudQueryFixture();
  const retired = new AbortController(),
    currentOwner = new AbortController();
  let reply: ReturnType<typeof f.holdReply> | undefined;
  let current: ReturnType<typeof f.holdStatus> | undefined;
  try {
    await f.open();
    const query = f.queries.account;
    reply = f.holdReply((method, input) => method === "account.read" && input.query?.operation === "refresh");
    const old = query.refresh(retired.signal);
    await reply.entered;
    retired.abort();
    await expect(old).rejects.toBeDefined();
    current = f.holdStatus();
    let settled = false;
    const newer = query.refresh(currentOwner.signal);
    void newer.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await current.entered;
    f.accountChanged();
    reply.release();
    await turn();
    expect(settled).toBe(false);
    expect(f.reads.status).toBe(3);
    const latest = { ...cloudAccount, cloudProjects: ["project", "latest"] };
    f.setAccount(latest);
    current.resolve(cloudAccount);
    expect(await newer).toEqual(latest);
    expect(f.reads.status).toBe(4);
    expect(f.maxLive.status).toBe(1);
  } finally {
    retired.abort();
    currentOwner.abort();
    reply?.release();
    current?.resolve(cloudAccount);
    await f.dispose();
  }
});

test("optional Cloud sync cancellation drains the actual HTTP child before return; mandatory account remains shared", async () => {
  const f = cloudQueryFixture();
  let retired: ReturnType<typeof f.holdSync> | undefined;
  try {
    await f.open();
    const sync = f.queries.projectSync;
    retired = f.holdSync();
    f.invalidate(sync);
    await retired.entered;
    f.detach();
    await retired.aborted;
    expect(f.account.inspect().automaticObservers).toBe(1);
    f.observe(sync);
    expect(await sync.read()).toEqual({ state: "synced", offlineReady: true });
    retired.resolve({ state: "offline", offlineReady: true });
    await turn();
    expect(sync.getSnapshot().data?.state).toBe("synced");
    expect(f.reads).toEqual({ status: 1, sync: 3, devices: 0 });
    expect(f.maxLive.sync).toBe(1);
  } finally {
    retired?.resolve({ state: "synced", offlineReady: true });
    await f.dispose();
  }
});

test("a surviving Cloud peer and explicit reader keep their shared child after the first view leaves", async () => {
  const f = cloudQueryFixture();
  let pending: ReturnType<typeof f.holdSync> | undefined;
  const stops: (() => void)[] = [];
  try {
    await f.open();
    const query = f.queries.projectSync;
    const stop = query.subscribe(() => {});
    stops.push(stop);
    pending = f.holdSync();
    f.invalidate(query);
    await pending.entered;
    const reading = query.read();
    f.detach();
    stop();
    expect(f.live.sync).toBe(1);
    expect(f.reads.sync).toBe(2);
    pending.resolve({ state: "offline", offlineReady: true });
    expect((await reading).state).toBe("offline");
    expect(f.maxLive.sync).toBe(1);
  } finally {
    pending?.resolve({ state: "synced", offlineReady: true });
    for (const stop of stops) stop();
    await f.dispose();
  }
});
