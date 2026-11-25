import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { projects } from "../../db/schemas.pg";
import { createExtensionStorageFixture } from "../extension-storage/extension-storage.fixture";
import { createAssetTransfersDBService } from "./asset-transfers";

test("transfer retries and cancellation belong to an integer owner and clear when its project is recreated", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const transfers = createAssetTransfersDBService(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "example.assets" };
    const otherProject = { ...owner, workbenchId: fixture.projectBId };
    const otherExtension = { ...owner, extensionId: "example.other" };
    const expected = { sha256: "a".repeat(64), byteLength: 17, mediaType: "text/plain" };
    const original = await transfers.begin(owner, "same-operation", expected);
    expect(await transfers.begin(owner, "same-operation", { ...expected, byteLength: 99 })).toEqual(original);
    await transfers.begin(otherProject, "same-operation", { ...expected, byteLength: 21 });
    await transfers.begin(otherExtension, "same-operation", { ...expected, byteLength: 22 });
    const cancelled = await transfers.cancel(owner, "same-operation");
    expect(cancelled?.cancelled_at).toBeString();
    expect(await transfers.cancel(owner, "same-operation")).toEqual(cancelled);
    expect((await transfers.get(otherProject, "same-operation"))?.cancelled_at).toBeNull();
    const rows = await fixture.db.execute<{ id: number; project_id: string; extension_id: string }>(sql`
      SELECT owners.id, owners.project_id, owners.extension_id FROM asset_transfers
      JOIN owners ON asset_transfers.owner_id=owners.id ORDER BY owners.id`);
    expect(rows.rows).toHaveLength(3);
    expect(new Set(rows.rows.map((row) => row.id)).size).toBe(3);
    await fixture.db.delete(projects).where(eq(projects.id, fixture.projectAId));
    const stamp = new Date().toISOString();
    await fixture.db.insert(projects).values({
      id: fixture.projectAId,
      name: "Recreated",
      shorthand: "A",
      created_at: stamp,
      updated_at: stamp,
    });
    expect(await transfers.get(owner, "same-operation")).toBeNull();
    expect(await transfers.get(otherExtension, "same-operation")).toBeNull();
    expect((await transfers.get(otherProject, "same-operation"))?.expected.byteLength).toBe(21);
    expect((await transfers.begin(owner, "same-operation", expected)).cancelled_at).toBeNull();
  } finally {
    await fixture.close();
  }
});
