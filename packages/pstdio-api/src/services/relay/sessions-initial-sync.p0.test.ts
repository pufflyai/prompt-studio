import { expect, test } from "bun:test";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import { createTestApp } from "../../test-utils/create-test-app";
import { createExtensionDocumentSync } from "./documents";
import { sessionsSyncFixture } from "./sessions-sync.fixture";

test("Sessions initial sync resumes its saved draft files and finishes without losing local edits", async () => {
  const apps = [await createTestApp(), await createTestApp()];
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "pstdio.pstdio-session-browser" };
  const { server, blobs, offsets, held, pause, close } = sessionsSyncFixture();
  const syncs: ReturnType<typeof createExtensionDocumentSync>[] = [];
  const controller = new AbortController();
  let pending: Promise<void> | undefined;
  try {
    for (const [index, app] of apps.entries()) {
      await app.deps.projectService.create({ id: projectId, name: "Sessions" });
      syncs.push(
        createExtensionDocumentSync({
          owner,
          deps: app.deps,
          config: {
            accountId: "account",
            workbenchId: projectId,
            environmentId: `device-${index}`,
            managerOrigin: server.url.origin,
            relayOrigin: server.url.origin,
            renewalGrant: "fixture",
          },
          access: async () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        }),
      );
    }
    const storage = await apps[0]!.deps.extensionStorageService.open({
      owner,
      assets: createRecordAssets(apps[0]!.deps.assetTransferService, owner),
    });
    const data = JSON.stringify({ prompt: "Synthetic draft", padding: "x".repeat(180) });
    const asset = await apps[0]!.deps.assetTransferService.stage(
      owner,
      "draft-file",
      new Blob([data], { type: "application/json" }),
    );
    const nextAsset = await apps[0]!.deps.assetTransferService.stage(
      owner,
      "next-draft-file",
      new Blob([`${data}\n`], { type: "application/json" }),
    );
    await storage.records.commit({
      operationId: "saved-draft",
      edits: [
        { recordId: "draft:draft", replace: { name: "draft-draft.json" }, asset },
        { recordId: "draft:next", replace: { name: "draft-next.json" }, asset: nextAsset },
      ],
    });
    await syncs[0]!.synchronize(controller.signal);
    pause();
    pending = syncs[1]!.synchronize(controller.signal);
    const failure = pending.catch((error) => error);
    await held;
    const ciphertext = [...blobs.values()].find((bytes) => bytes.length < 400)!;
    const identity = JSON.stringify([
      new Bun.CryptoHasher("sha256").update(ciphertext).digest("hex"),
      ciphertext.length,
      "application/octet-stream",
    ]);
    const operationId = `sync-receive:${new Bun.CryptoHasher("sha256").update(identity).digest("hex")}`;
    const deadline = Date.now() + 1000;
    while (true) {
      const transfer = await apps[1]!.deps.assetTransferService.get(owner, operationId);
      if (transfer?.status === "staging" && transfer.uploadedByteLength === 32) break;
      if (Date.now() > deadline) throw new Error("Draft bytes did not reach the resumable checkpoint");
      await Bun.sleep(5);
    }
    const stalled = await syncs[1]!.status();
    expect(stalled).toMatchObject({ firstDownloaded: false, downloaded: false, download: { total: null } });
    expect(stalled.files).toContainEqual(
      expect.objectContaining({ name: "draft-draft.json", direction: "download", status: "active" }),
    );
    expect(stalled.files).toContainEqual(
      expect.objectContaining({ name: "draft-next.json", direction: "download", status: "queued" }),
    );
    controller.abort(new Error("Retry this source"));
    expect(await failure).toBe(controller.signal.reason);
    const stopped = await syncs[1]!.status();
    expect(stopped.files.some((file) => file.status === "queued" || file.status === "active")).toBe(false);
    expect(stopped.files).toContainEqual(expect.objectContaining({ name: "draft-draft.json", status: "failed" }));
    const peer = await apps[1]!.deps.extensionStorageService.open({ owner });
    await peer.records.commit({
      operationId: "local-edit",
      edits: [{ recordId: "local-only", replace: { retained: true } }],
    });
    await syncs[1]!.synchronize(new AbortController().signal);
    expect((await peer.records.read("draft:draft")).value).toEqual({ name: "draft-draft.json" });
    expect((await peer.records.read("local-only")).value).toEqual({ retained: true });
    expect(await new Response(await apps[1]!.deps.assetTransferService.read(owner, asset)).text()).toBe(data);
    expect(offsets).toContain(32);
    expect(await syncs[1]!.status()).toMatchObject({
      firstDownloaded: true,
      downloaded: true,
      phase: "ready",
      download: { total: 3 },
    });
  } finally {
    controller.abort();
    await pending?.catch(() => {});
    await Promise.all(syncs.map((sync) => sync.close()));
    await close();
    await Promise.all(apps.map((app) => app.close()));
  }
});
