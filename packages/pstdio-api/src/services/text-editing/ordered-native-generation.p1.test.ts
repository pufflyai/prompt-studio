import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTextEditingClient, type GuestHost } from "@pstdio/sdk/extensions";
import type { TextEditingRequest, TextWireSnapshot } from "pstdio-api-contracts/extension-kernel";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import * as Y from "yjs";
import { numberRelayFixture } from "../relay/resource-number-sync.fixture";
import { selected, textEditingFixture } from "./text-editing.test-fixture";

/** Real ordered relay + SQL authority; only network delivery of the SDK batch is held. */
test("a real refused field group fences SDK deltas and full-state reopen while preserving editor recovery", async () => {
  const f = await textEditingFixture();
  const peer = await createDb({ path: ":memory:" });
  const connections: { projectId: string; token: string }[] = [];
  try {
    await writeFile(
      join(f.root, "extension.ts"),
      `export default {
      storage:{records:{text:[{prefix:"card:",fields:["/description"]}]}},
      textSources:[{id:"body",ref:{kind:"text-source",id:"body"},params:{},
        resolve:async ctx=>({source:{kind:"record",recordId:"card:one",field:"/description"},content:(await ctx.storage.records.read("card:one")).value.description,editable:true}),
        project:async()=>{throw new Error("The ordered field already materialized");}}],
      views:[{id:"document",ref:{kind:"view",id:"document"},title:"Document",body:{kind:"file",load:async()=>({textDocument:{sourceId:"body",params:{}},fileName:"note.md"})}}]
    };`,
    );
    f.deps.extensionRuntimeCatalog.invalidate({ projectId: "project-1", reason: "source_changed" });
    Object.assign(f.deps.extensionService, {
      getProjectExtensionInstance: async () =>
        (await f.deps.extensionService.listEnabledSourcesForProject("project-1"))[0],
    });
    const owner = { workbenchId: "project-1", extensionId: "example.context" };
    const textFields = [{ prefix: "card:", fields: ["/description"] }];
    const local = (await f.deps.extensionStorageService.open({ owner, textFields })).records;
    const now = new Date().toISOString();
    await peer.db
      .insert(projects)
      .values({ id: owner.workbenchId, name: "Peer", shorthand: "P", created_at: now, updated_at: now });
    const remoteService = createExtensionStorageDBService(peer.db);
    const remote = (await remoteService.open({ owner, textFields })).records;
    const space = await createSyncSpace({
      projectId: owner.workbenchId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
    const relay = numberRelayFixture().relay(documentId);
    const failures: unknown[] = [];
    const sync = (store: Parameters<typeof createRecordStreamSync>[0]["store"]) =>
      createRecordStreamSync({
        space,
        documentId,
        relay,
        store,
        quarantine: async (failure) => {
          failures.push(failure);
        },
      });
    const localSync = sync(f.deps.extensionStorageService.documents.recordStream(owner));
    const remoteSync = sync(remoteService.documents.recordStream(owner));
    await local.commit({
      operationId: "seed",
      edits: [{ recordId: "card:one", replace: { model: "small", description: "source" } }],
    });
    const initialRoom = await f.documents.open({ projectId: owner.workbenchId, ...selected });
    await f.documents.close({ projectId: owner.workbenchId, roomId: initialRoom.roomId });
    await localSync.synchronize();
    await remoteSync.synchronize();
    const observed = await local.read("card:one");
    await local.commit({
      operationId: "conditional",
      edits: [
        {
          recordId: "card:one",
          expectedRevision: observed.revision,
          replace: { model: "careful", description: "LOCAL source" },
        },
      ],
    });
    const address = {
      projectId: owner.workbenchId,
      ...(await f.text.connect(owner.workbenchId, { kind: "placement", target: selected })),
    };
    connections.push(address);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let opened: { handle: string; snapshot: TextWireSnapshot } | undefined;
    const host = {
      call: async (_name: string, input: TextEditingRequest) => {
        if (input.operation === "submit") {
          entered.resolve();
          await release.promise;
        }
        const result = await f.text.request(address, input);
        if (input.operation === "open") opened = result as typeof opened;
        return result;
      },
      onEvent: (_scope: string, handler: (value: unknown) => void) => f.text.listen(address, handler),
    } as GuestHost;
    const client = createTextEditingClient(host);
    const session = await client.open({ grant: (await client.current())! });
    expect(session.getSnapshot().text.toString()).toBe("LOCAL source");
    const draft = session.createDraft();
    draft.text.insert(draft.text.length, " private draft");
    session.transact((text) => text.insert(text.length, " pending delta"));
    const flushed = session.flush().then(
      () => undefined,
      (error: unknown) => error,
    );
    await entered.promise;
    await remote.commit({ operationId: "peer", edits: [{ recordId: "card:one", set: { "/model": "remote" } }] });
    await remoteSync.synchronize();
    await localSync.synchronize();
    release.resolve();
    expect(await flushed).toMatchObject({ code: "source_retired" });
    expect((await local.outcome("conditional"))?.state).toBe("refused");
    expect(session.getSnapshot().pending).toBe(true);
    expect(session.getSnapshot().text.toString()).toBe("LOCAL source pending delta");
    expect(draft.text.toString()).toBe("LOCAL source private draft");
    const canonical = f.deps.extensionStorageService.openNativeTextDocument({ owner, fileId: initialRoom.documentKey });
    const current = await canonical.snapshot();
    expect(current.generation).not.toBe(opened!.snapshot.generation);
    expect(await canonical.read()).toBe("source");
    const freshAddress = {
      projectId: owner.workbenchId,
      ...(await f.text.connect(owner.workbenchId, { kind: "placement", target: selected })),
    };
    connections.push(freshAddress);
    const grant = await f.text.request(freshAddress, { operation: "current" });
    const memberId = crypto.randomUUID();
    await f.text.request(freshAddress, { operation: "register", memberId });
    const recovery = {
      operation: "open" as const,
      memberId,
      input: { grant: grant! },
      sourceState: Buffer.from(Y.encodeStateAsUpdate(session.getSnapshot().text.doc!)).toString("base64"),
    };
    await expect(
      f.text.request(freshAddress, { ...recovery, generation: opened!.snapshot.generation }),
    ).rejects.toMatchObject({ code: "source_retired" });
    await expect(f.text.request(freshAddress, recovery)).rejects.toMatchObject({ code: "source_retired" });
    expect(await canonical.read()).toBe("source");
    const healthy = await f.text.request(freshAddress, { operation: "open", memberId, input: { grant: grant! } });
    const healthyDocument = new Y.Doc();
    try {
      Y.applyUpdate(healthyDocument, Buffer.from(healthy.snapshot.state, "base64"));
      expect(healthyDocument.getText("content").toString()).toBe("source");
      expect(healthy.snapshot.seedId).toBe(opened!.snapshot.seedId);
      const vector = Y.encodeStateVector(healthyDocument);
      healthyDocument.getText("content").insert(healthyDocument.getText("content").length, " fresh");
      await f.text.request(freshAddress, {
        operation: "submit",
        handle: healthy.handle,
        sequence: 1,
        update: Buffer.from(Y.encodeStateAsUpdate(healthyDocument, vector)).toString("base64"),
      });
      await localSync.synchronize();
      await remoteSync.synchronize();
      expect(await canonical.read()).toBe("source fresh");
      expect((await remote.read("card:one")).value).toEqual({ model: "remote", description: "source fresh" });
    } finally {
      healthyDocument.destroy();
    }
    expect(failures).toEqual([]);
  } finally {
    for (const address of connections) await f.text.disconnect(address);
    await peer.close();
    await f.cleanup();
  }
});
