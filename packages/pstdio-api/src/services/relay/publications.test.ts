import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyRecordChange, blankRecord } from "pstdio-sync";
import { type Change, fingerprint, publishedExtensionsId, sealMutation } from "pstdio-sync-contracts";
import { loadAutomationPreferences } from "../../features/extensions/extension-automations";
import { packExtension } from "../../features/extensions/publication/package";
import { packageRevision } from "../../features/extensions/publication/prepare";
import {
  createTestExtensionSource,
  createTestScheduledExtensionSource,
} from "../../features/extensions/test-utils/create-test-extension-source";
import { createTestApp } from "../../test-utils/create-test-app";
import { discoveryPeer } from "./discovery-peer.fixture";
import { startRelayRuntime } from "./runtime";

test("an empty environment discovers published packages and one failed activation does not block another extension", async () => {
  const root = await mkdtemp(join(tmpdir(), "publication-discovery-"));
  const app = await createTestApp();
  const wire = discoveryPeer("owner");
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "New environment" });
    const scope = { accountId: "owner", workbenchId: project.id, extensionId: publishedExtensionsId };
    const changes: Change[] = [];
    for (const name of ["broken", "unrelated"]) {
      const createSource = name === "unrelated" ? createTestScheduledExtensionSource : createTestExtensionSource;
      const source = createSource({ root, installName: name, name, displayName: name });
      if (name === "broken")
        await writeFile(
          join(source, "extension.ts"),
          'throw new Error("incompatible on this environment"); export default {};',
        );
      const bytes = await packExtension(source);
      const revision = await packageRevision(bytes);
      const asset = { sha256: revision, byteLength: bytes.size, mediaType: bytes.type };
      wire.assets.set(revision, new Uint8Array(await bytes.arrayBuffer()));
      changes.push({
        recordId: `test.${name}`,
        expectedRevision: 0,
        baseDeleted: false,
        value: {
          expected: await fingerprint(null),
          next: { extensionId: `test.${name}`, revision, automation: name === "unrelated", enabled: true },
        },
        asset: { base: null, next: asset },
      });
    }
    const mutation = await sealMutation({
      protocolVersion: 1,
      scope,
      environmentId: "publisher",
      operationId: crypto.randomUUID(),
      parents: [],
      changes,
    });
    const checkpoint = { epoch: "published", sequence: 1 };
    wire.snapshots.set(JSON.stringify([project.id, publishedExtensionsId]), {
      protocolVersion: 1,
      scope,
      publishedRevision: "published-extensions-v1",
      checkpoint,
      journalSequence: 1,
      records: Object.fromEntries(
        changes.map((change) => [change.recordId, applyRecordChange(blankRecord(change.recordId), change)]),
      ),
      receipts: {
        [mutation.operationId]: {
          operationId: mutation.operationId,
          fingerprint: mutation.fingerprint,
          mutation,
          status: "accepted",
          order: 1,
          checkpoint,
        },
      },
      conflicts: {},
    });
    const environment = await app.deps.environmentService.get();
    const path = join(root, "relay.json");
    await writeFile(
      path,
      JSON.stringify({
        connections: [
          {
            accountId: "owner",
            workbenchId: project.id,
            environmentId: environment.environmentId,
            relayOrigin: wire.peer.url.origin,
            managerOrigin: wire.peer.url.origin,
            renewalGrant: "owned-grant",
          },
        ],
      }),
    );
    expect(await app.deps.extensionService.listProjectExtensionInstances(project.id)).toHaveLength(0);
    runtime = await startRelayRuntime({ path, environment: app.deps.environmentService, deps: app.deps });
    const deadline = Date.now() + 2000;
    while (!(await app.deps.extensionService.listProjectExtensionInstances(project.id)).length && Date.now() < deadline)
      await Bun.sleep(10);
    const sources = await app.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.installedSource.extension_id).toBe("test.unrelated");
    expect(sources[0]!.instance.enabled).toBe(true);
    const localToggle = await app.app.request(`/v1/projects/${project.id}/extensions/${sources[0]!.instance.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(localToggle.status).toBe(409);
    await app.deps.extensionAutomationPreferencesService.set({
      project_id: project.id,
      extension_instance_id: sources[0]!.instance.id,
      automation_id: "test.unrelated.schedule.heartbeat",
      enabled: false,
    });
    expect(await loadAutomationPreferences(app.deps, project.id)).toHaveLength(0);
    expect(await app.deps.extensionAutomationPreferencesService.list(project.id)).toHaveLength(1);

    expect(
      (await app.deps.extensionRuntimeCatalog.get(project.id)).runtime.extensions.map((extension) => extension.id),
    ).toContain("test.unrelated");
  } finally {
    await runtime?.close();
    await wire.peer.stop(true);
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
