import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createResourceActivityApi } from "../../features/activity/resource-activity-api";
import { activityStorageOwner } from "../../features/activity/resource-activity-store";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { createExtensionDocumentSync } from "./documents";

test("Activity and content-addressed evidence converge between devices without an installed core owner", async () => {
  const root = mkdtempSync(join(tmpdir(), "activity-sync-"));
  const peer = documentPeer();
  const apps = await Promise.all([createTestApp(), createTestApp()]);
  const controller = new AbortController();
  const syncs: ReturnType<typeof createExtensionDocumentSync>[] = [];
  try {
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
  } finally {
    controller.abort();
    await Promise.all(syncs.map((sync) => sync.close()));
    await Promise.all(apps.map((app) => app.close()));
    await peer.close();
    rmSync(root, { recursive: true, force: true });
  }
});
