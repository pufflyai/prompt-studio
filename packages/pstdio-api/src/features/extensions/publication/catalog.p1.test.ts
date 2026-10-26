import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import { loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";

test("publication is explicit, captures package bytes, and checks the observed catalog revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "published-catalog-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create(folderProjectInput({ name: "Published" }));
    const source = createTestExtensionSource({
      root,
      installName: "unrelated",
      name: "unrelated",
      displayName: "Unrelated",
    });
    const loaded = await loadExtensionSource(source);
    const enabled = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: source,
      extensionId: loaded.metadata.id,
      installName: "unrelated",
      name: "unrelated",
      displayName: "Unrelated",
      manifest: loaded.manifest,
    });
    const path = `/v1/projects/${project.id}/extension-publications`;
    const before = await app.app.request(path);
    expect(before.status).toBe(200);
    const records = (await before.json()) as { recordId: string; revision: string; value: unknown }[];
    expect(records[0].value).toBe(null);
    await writeFile(join(source, "local.txt"), "unpublished");
    expect(((await (await app.app.request(path)).json()) as { value: unknown }[])[0].value).toBe(null);
    const publish = () =>
      app.app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "publish",
          instanceId: enabled.instance.id,
          expectedRevision: records[0].revision,
        }),
      });
    const saved = await publish();
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as { status: string }).status).toBe("saved-locally");
    const published = (await (await app.app.request(path)).json()) as {
      value: { revision: string };
      asset: { sha256: string };
    }[];
    expect(published[0].value.revision).toBe(published[0].asset.sha256);
    expect((await publish()).status).toBe(409);
    const toggle = await app.app.request(`/v1/projects/${project.id}/extensions/${enabled.instance.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(toggle.status).toBe(200);
    const disabled = (await (await app.app.request(path)).json()) as { value: { enabled: boolean } }[];
    expect(disabled[0]!.value.enabled).toBe(false);
    const stage = app.deps.assetTransferService.stage;
    const preparing = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    app.deps.assetTransferService.stage = async (...args) => {
      const asset = await stage(...args);
      preparing.resolve();
      await resume.promise;
      return asset;
    };
    const observed = (await (await app.app.request(path)).json()) as { revision: string }[];
    const overlapping = app.app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "publish",
        instanceId: enabled.instance.id,
        expectedRevision: observed[0]!.revision,
      }),
    });
    await preparing.promise;
    const newer = await app.app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "enabled",
        extensionId: loaded.metadata.id,
        enabled: true,
        expectedRevision: observed[0]!.revision,
      }),
    });
    expect(newer.status).toBe(200);
    resume.resolve();
    expect((await overlapping).status).toBe(409);
    expect(((await (await app.app.request(path)).json()) as { value: { enabled: boolean } }[])[0]!.value.enabled).toBe(
      true,
    );
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
