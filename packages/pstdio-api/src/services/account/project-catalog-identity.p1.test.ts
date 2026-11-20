import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccountHostFixture } from "./native-host.fixture";
import { createNativeStore } from "./native-store";

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "catalog-identity-"));
  let host = await createAccountHostFixture(root);
  const projectId = crypto.randomUUID();
  const deletion = {
    workbenchId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    state: "deleting",
  };
  let unavailable = false;
  const manager = () =>
    Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === "/v1/account") return Response.json({ features: { relay: true }, projectDeletion: true });
        if (path === "/v1/workbenches") return Response.json([{ workbenchId: projectId }]);
        if (path === "/v1/project-deletions")
          return unavailable ? Response.json({ error: "unavailable" }, { status: 500 }) : Response.json([deletion]);
        return Response.json({ ok: true });
      },
    });
  const first = manager();
  const second = manager();
  const deviceId = (await host.deps.environmentService.get()).environmentId;
  const login = {
    managerOrigin: first.url.origin,
    relayOrigin: first.url.origin,
    accountId: "first-account",
    deviceId,
    token: "same-token-issued-by-two-managers",
  };
  const replacement = {
    ...login,
    managerOrigin: second.url.origin,
    relayOrigin: second.url.origin,
    accountId: "second-account",
  };
  await host.projects.create({ id: projectId, name: "First account's project" });
  const store = createNativeStore(host.file);
  await store.save(login);
  await host.account.refresh();
  return {
    root,
    projectId,
    deletion,
    login,
    replacement,
    store,
    host: () => host,
    unavailable: () => {
      unavailable = true;
    },
    async reopen() {
      await host.close();
      host = await createAccountHostFixture(root);
      await host.account.refresh();
    },
    async close() {
      await host.close();
      await Promise.all([first.stop(true), second.stop(true)]);
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("a fresh catalog and account status cannot reuse another manager's equal-token snapshot", async () => {
  const device = await fixture();
  try {
    expect((await device.host().account.catalogProjects()).projects).toHaveLength(1);
    await device.store.save(device.replacement);
    expect(await device.host().account.catalogProjects()).toMatchObject({ projects: [], deletions: [] });
    expect(await device.host().account.status()).toMatchObject({
      cloudProjects: [],
      cloudProjectsLoaded: false,
      features: null,
    });
  } finally {
    await device.close();
  }
});

test("a catalog read rejects a same-token manager switch while metadata is being read", async () => {
  const device = await fixture();
  const projects = device.host().projects;
  const original = projects.get;
  const entered = Promise.withResolvers<void>();
  const proceed = Promise.withResolvers<void>();
  projects.get = async (id) => {
    entered.resolve();
    await proceed.promise;
    return original(id);
  };
  const pending = device.host().account.catalogProjects();
  const outcome = pending.catch((error) => error);
  try {
    await entered.promise;
    await device.store.save(device.replacement);
    proceed.resolve();
    expect(await outcome).toBeInstanceOf(Error);
  } finally {
    proceed.resolve();
    await outcome;
    projects.get = original;
    await device.close();
  }
});

test("cold membership discovery survives deletion-status failure and keeps the saved receipt", async () => {
  const device = await fixture();
  try {
    expect(
      device
        .host()
        .synced()
        .map((connection) => connection.workbenchId),
    ).toEqual([device.projectId]);
    device.unavailable();
    await device.reopen();
    expect(
      device
        .host()
        .synced()
        .map((connection) => connection.workbenchId),
    ).toEqual([device.projectId]);
    expect(await device.host().account.catalogProjects()).toMatchObject({
      deletions: [{ operationId: device.deletion.operationId }],
    });
    expect((await device.host().account.status()).cloudProjectsLoaded).toBe(true);
  } finally {
    await device.close();
  }
});
