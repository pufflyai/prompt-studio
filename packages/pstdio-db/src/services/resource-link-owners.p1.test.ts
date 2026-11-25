import { expect, test } from "bun:test";
import { clearOwnerDocuments } from "./extension-storage/clear-documents";
import { createExtensionStorageFixture } from "./extension-storage/extension-storage.fixture";
import { createResourceLinksDBService } from "./resource-links";

test("removing either link owner clears its links and preserves other owners and projects", async () => {
  const f = await createExtensionStorageFixture();
  try {
    const links = createResourceLinksDBService(f.db);
    const source = { projectId: f.projectAId, extensionId: "example.notes", type: "item", id: "same" };
    const target = { ...source, extensionId: "example.art", label: "Saved target", metadata: { revision: 2 } };
    await links.add(source, [target]);
    const unrelated = { ...source, extensionId: "example.other" };
    await links.add(unrelated, [{ ...target, extensionId: "example.retained" }]);
    const foreign = { ...source, projectId: f.projectBId };
    await links.add(foreign, [{ ...target, projectId: f.projectBId }]);
    await f.db.transaction((tx) =>
      clearOwnerDocuments(tx, { workbenchId: source.projectId, extensionId: target.extensionId }),
    );
    expect((await links.list({ resource: source })).items).toEqual([]);
    expect((await links.list({ resource: unrelated })).items).toHaveLength(1);
    expect((await links.list({ resource: foreign })).items).toHaveLength(1);
    await links.add(source, [target]);
    await f.db.transaction((tx) =>
      clearOwnerDocuments(tx, { workbenchId: source.projectId, extensionId: source.extensionId }),
    );
    expect((await links.list({ resource: target, direction: "incoming" })).items).toEqual([]);
    expect((await links.list({ resource: foreign })).items[0]?.target.metadata).toEqual({ revision: 2 });
  } finally {
    await f.close();
  }
});
