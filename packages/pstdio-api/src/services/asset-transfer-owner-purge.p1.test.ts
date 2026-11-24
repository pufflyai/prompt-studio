import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAssetTransfersDBService,
  createDb,
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createAssetBytesStorage } from "pstdio-storage";
import { createAssetTransferService } from "./asset-transfer-service";

const reference = (value: string) => ({
  sha256: createHash("sha256").update(value).digest("hex"),
  byteLength: Buffer.byteLength(value),
  mediaType: "text/plain",
});

test("reusing a cleared owner's transfer starts empty while completed asset versions remain readable", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-owner-purge-"));
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Assets" });
    const owner = { workbenchId: project.id, extensionId: "example.assets" };
    const source = await createInstalledExtensionSourcesDBService(connection.db).register({
      install_name: "assets",
      extension_id: owner.extensionId,
      display_name: "Assets",
      source_kind: "local_path",
      source_path: root,
    });
    const instance = await createExtensionInstancesDBService(connection.db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: project.id,
    });
    const transfers = createAssetTransfersDBService(connection.db);
    const bytes = createAssetBytesStorage(root);
    const service = createAssetTransferService({ transfers, bytes });
    const retained = await service.stage(owner, "keep", new Blob(["kept"], { type: "text/plain" }));
    await service.begin(owner, "reused", reference("old-body"));
    await service.append(owner, "reused", 0, new Blob(["old"]).stream());
    expect(await bytes.progress(owner, "reused")).toBe(3);
    await createExtensionUserDataDBService(connection.db).deleteForInstance(instance.id);
    expect(await transfers.get(owner, "reused")).toBeNull();
    expect(await service.begin(owner, "reused", reference("new"))).toMatchObject({
      status: "staging",
      uploadedByteLength: 0,
    });
    await service.append(owner, "reused", 0, new Blob(["new"]).stream());
    expect(await service.complete(owner, "reused")).toMatchObject({ status: "complete", asset: reference("new") });
    expect(await new Response(await service.read(owner, retained)).text()).toBe("kept");
  } finally {
    await connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
