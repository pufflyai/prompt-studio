import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createResourceActivityApi } from "../../features/activity/resource-activity-api";
import { activityStorageOwner } from "../../features/activity/resource-activity-store";
import { openSeenStore, seenOwnerId, seenStoreFor } from "../../features/activity/resource-seen";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { createExtensionDocumentSync } from "./documents";
import { startRelayRuntime } from "./runtime";

const root = mkdtempSync(join(tmpdir(), "activity-sync-"));
const peer = documentPeer();
const apps: Awaited<ReturnType<typeof createTestApp>>[] = [];
beforeAll(async () => {
  apps.push(await createTestApp());
});
beforeAll(async () => {
  apps.push(await createTestApp());
});
const controller = new AbortController();
const syncs: ReturnType<typeof createExtensionDocumentSync>[] = [];
afterAll(async () => {
  controller.abort();
  await Promise.all(syncs.map((sync) => sync.close()));
  await Promise.all(apps.map((app) => app.close()));
  await peer.close();
  rmSync(root, { recursive: true, force: true });
});
test("Activity and content-addressed evidence converge between devices without an installed core owner", async () => {
  const projectId = crypto.randomUUID();
  const source = join(root, "owner");
  mkdirSync(source);
  const manifest = {
    name: "activity-sync-test",
    publisher: "test",
    version: "1.0.0",
    main: "extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(
    join(source, "extension.ts"),
    'export default {resourceKinds:[{id:"note",ref:{kind:"resource-kind",id:"note"},activity:{comments:true},resolveMany:{kind:"command",id:"resolve"}}],commands:[{id:"resolve",ref:{kind:"command",id:"resolve"},title:"Resolve",run(ctx,p){return p.resources.map(resource=>({resource}));}}]};',
  );
  for (const [index, app] of apps.entries()) {
    await app.deps.projectService.create({ id: projectId, name: "Shared Activity" });
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId,
      sourcePath: source,
      sourceKind: "local_path",
      name: manifest.name,
      installName: manifest.name,
      extensionId: "test.activity-sync-test",
      displayName: "Notes",
      manifest,
    });
    syncs.push(
      createExtensionDocumentSync({
        owner: activityStorageOwner(projectId),
        deps: app.deps,
        config: {
          accountId: "account",
          workbenchId: projectId,
          environmentId: `device-${index}`,
          managerOrigin: peer.origin,
          relayOrigin: peer.origin,
          renewalGrant: "grant",
        },
        access: async () => ({ token: "device", expiresAt: new Date(Date.now() + 60000).toISOString() }),
      }),
    );
  }
  const ref = { projectId, extensionId: "test.activity-sync-test", type: "note", id: "same" };
  const apis = apps.map((app) => createResourceActivityApi(app.deps, { projectId }));
  const first = await apis[0]!.attach(ref, {
    key: "evidence",
    name: "evidence.log",
    mimeType: "text/plain",
    data: new TextEncoder().encode("First verified log"),
  });
  const second = await apis[1]!.attach(ref, {
    key: "evidence",
    name: "evidence.log",
    mimeType: "text/plain",
    data: new TextEncoder().encode("Other verified log"),
  });
  expect(first.id).not.toBe(second.id);
  const comment = await apis[0]!.publish(ref, {
    key: "comment",
    kind: "comment",
    body: "Please inspect evidence",
    attachmentIds: [first.id],
  });
  await syncs[0]!.synchronize(controller.signal);
  await syncs[1]!.synchronize(controller.signal);
  await syncs[0]!.synchronize(controller.signal);
  expect((await apis[1]!.get(ref, comment.id)).attachments).toEqual([first]);
  for (const api of apis) {
    expect(new TextDecoder().decode((await api.readAttachment(ref, first.id)).data)).toBe("First verified log");
    expect(new TextDecoder().decode((await api.readAttachment(ref, second.id)).data)).toBe("Other verified log");
  }
});

test("offline first views merge by maximum revision in the reader's personal space", async () => {
  const projectId = crypto.randomUUID();
  await Promise.all(apps.map((app) => app.deps.projectService.create({ id: projectId, name: "Personal baselines" })));
  const login = { managerOrigin: peer.origin, accountId: "alice" };
  const principal = seenOwnerId(login);
  const resource = { extensionId: "example.publisher", type: "edition", projectId, id: "one" };
  const head = (revision: string) => ({ resource, stamp: { lineage: "original", revision }, provider: "publisher" });
  const stores = await Promise.all(apps.map((app) => seenStoreFor(app.deps, projectId, principal)));
  const devices = await Promise.all(apps.map((app) => app.deps.environmentService.get()));
  expect(devices[0]!.environmentId).not.toBe(devices[1]!.environmentId);
  const privateSyncs = apps.map((app, i) =>
    createExtensionDocumentSync({
      owner: { workbenchId: projectId, extensionId: principal },
      privateSpace: true,
      deps: app.deps,
      config: {
        ...login,
        workbenchId: projectId,
        environmentId: devices[i]!.environmentId,
        relayOrigin: peer.origin,
        renewalGrant: "grant",
      },
      access: async () => ({ token: "device", expiresAt: new Date(Date.now() + 60000).toISOString() }),
    }),
  );
  syncs.push(...privateSyncs);
  await stores[0]!.acknowledge(head("1"), "publisher");
  await stores[1]!.acknowledge(head("2"), "publisher");
  expect((await stores[0]!.query([head("2")]))[0]?.changedSinceSeen).toBe(true);
  for (const index of [0, 1, 0]) await privateSyncs[index]!.synchronize(controller.signal);
  for (const store of stores) {
    expect((await store.query([head("2"), head("3")])).map((x) => x.changedSinceSeen)).toEqual([false, true]);
  }
  const other = await seenStoreFor(apps[0]!.deps, projectId, seenOwnerId({ ...login, accountId: "bob" }));
  expect((await other.query([head("3")]))[0]?.changedSinceSeen).toBe(false);
});

test("native team relay synchronizes seen baselines only between the same user's devices", async () => {
  const projectId = crypto.randomUUID();
  const teamPeer = documentPeer();
  const hosts: Awaited<ReturnType<typeof createTestApp>>[] = [];
  const runtimes: Awaited<ReturnType<typeof startRelayRuntime>>[] = [];
  const resource = { extensionId: "example.publisher", type: "edition", projectId, id: "team-note" };
  const head = (revision: string) => ({ resource, stamp: { lineage: "original", revision }, provider: "publisher" });
  const stores: Awaited<ReturnType<typeof openSeenStore>>[] = [];
  try {
    for (const [index, accountId] of ["alice", "alice", "bob"].entries()) {
      const host = await createTestApp();
      hosts.push(host);
      await host.deps.projectService.create({ id: projectId, name: "Team baselines" });
      const { environmentId } = await host.deps.environmentService.get();
      const login = {
        accountId,
        deviceId: environmentId,
        managerOrigin: teamPeer.origin,
        relayOrigin: teamPeer.origin,
      };
      const status = await host.deps.accountService.status();
      host.deps.accountService.status = async () => ({
        ...status,
        login,
        teamProjects: { [projectId]: "team" },
      });
      const runtime = await startRelayRuntime({ deps: host.deps });
      runtimes.push(runtime);
      const store = await openSeenStore(host.deps, projectId);
      stores.push(store);
      if (index === 0) await store.acknowledge(head("2"), "publisher");
      if (index === 2) await store.acknowledge(head("9"), "publisher");
      await runtime.update([
        {
          accountId: "team",
          userId: login.accountId,
          workbenchId: projectId,
          environmentId,
          managerOrigin: teamPeer.origin,
          relayOrigin: teamPeer.origin,
          renewalGrant: "fixture",
        },
      ]);
      const deadline = Date.now() + 2000;
      const seen = async () => (await runtime.status(projectId)).sources?.find(({ id }) => id === "seen");
      let seenStatus = await seen();
      while (!seenStatus?.downloaded && Date.now() < deadline) {
        await Bun.sleep(10);
        seenStatus = await seen();
      }
      expect(seenStatus).toMatchObject({ downloaded: true });
    }
    const [, aliceSecond, bobFirst] = stores;
    const end = Date.now() + 3000;
    const changed = async (store: typeof aliceSecond, revision: string) =>
      (await store!.query([head(revision)]))[0]?.changedSinceSeen;
    while (!(await changed(aliceSecond, "3")) && Date.now() < end) await Bun.sleep(10);
    if (!(await changed(aliceSecond, "3"))) {
      const seen = await Promise.all(
        runtimes.map(async (runtime) => (await runtime.status(projectId)).sources?.find(({ id }) => id === "seen")),
      );
      throw new Error(`Seen resource baseline did not converge: ${JSON.stringify(seen)}`);
    }
    expect(await changed(aliceSecond, "2")).toBe(false);
    expect(await changed(bobFirst, "3")).toBe(false);
    expect(await changed(bobFirst, "10")).toBe(true);
  } finally {
    await Promise.all(runtimes.map((runtime) => runtime.close()));
    await Promise.all(hosts.map((host) => host.close()));
    await teamPeer.close();
  }
});
