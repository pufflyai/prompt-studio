import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createAssetTransfersDBService, createDb, createProjectsDBService } from "pstdio-db";
import { createAssetBytesStorage } from "pstdio-storage";
import { UnreadableSyncData } from "pstdio-sync";
import { createAssetTransferService } from "../../../services/asset-transfer-service";
import { createRecordAssets } from "./record-assets";

test("record downloads resume long media types and reuse complete retained bytes", async () => {
  const root = await mkdtemp(`${tmpdir()}/record-assets-`);
  const database = await createDb({ path: ":memory:" });
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example.records" };
  const reference = {
    sha256: createHash("sha256").update("hello").digest("hex"),
    byteLength: 5,
    mediaType: `application/${"a".repeat(120)}`,
  };
  try {
    await createProjectsDBService(database.db).create({ id: owner.workbenchId, name: "Download" });
    const port = createRecordAssets(
      createAssetTransferService({
        transfers: createAssetTransfersDBService(database.db),
        bytes: createAssetBytesStorage(root),
      }),
      owner,
    );
    const offsets: number[] = [];
    const incomplete = await port
      .receive(reference, async (offset) => {
        offsets.push(offset);
        return new Blob(["he"]).stream();
      })
      .catch((error: unknown) => error);
    expect(incomplete).toMatchObject({ code: "ASSET_INTEGRITY_MISMATCH" });
    await port.receive(reference, async (offset) => {
      offsets.push(offset);
      return new Blob(["hello".slice(offset)]).stream();
    });
    expect(offsets).toEqual([0, 2]);
    await port.verifyComplete([reference]);
    expect(await new Response(await port.read(reference)).text()).toBe("hello");
    await port.receive(reference, async () => {
      throw new Error("Complete bytes should be reused");
    });
    await port.receive({ ...reference, mediaType: "text/plain" }, async () => {
      throw new Error("Retained content should be reused across media types");
    });
    const simultaneous = { ...reference, sha256: createHash("sha256").update("other").digest("hex") };
    const download = () => port.receive(simultaneous, async (offset) => new Blob(["other".slice(offset)]).stream());
    expect(await Promise.allSettled([download(), download()])).toEqual([
      { status: "fulfilled", value: undefined },
      { status: "fulfilled", value: undefined },
    ]);
    expect(await new Response(await port.read(simultaneous)).text()).toBe("other");
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a complete download with the wrong bytes is unreadable", async () => {
  const root = await mkdtemp(`${tmpdir()}/record-assets-`);
  const database = await createDb({ path: ":memory:" });
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example.records" };
  const reference = {
    sha256: createHash("sha256").update("hello").digest("hex"),
    byteLength: 5,
    mediaType: "application/octet-stream",
  };
  try {
    await createProjectsDBService(database.db).create({ id: owner.workbenchId, name: "Download" });
    const port = createRecordAssets(
      createAssetTransferService({
        transfers: createAssetTransfersDBService(database.db),
        bytes: createAssetBytesStorage(root),
      }),
      owner,
    );
    // Sync sets unreadable data aside instead of retrying it on every pass.
    const damaged = await port.receive(reference, async () => new Blob(["jello"]).stream()).catch((error) => error);
    expect(damaged).toBeInstanceOf(UnreadableSyncData);
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});
