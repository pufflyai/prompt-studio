import { expect, test } from "bun:test";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createDocumentStorage } from "pstdio-sync/records";
import type { TeamExtensionPolicy } from "pstdio-sync-contracts";
import { AlwaysEnabledExtensionError } from "../always-on-extensions";
import { createPublicationCatalog } from "./catalog-store";

test("required team tools reject ordinary publication and released tools stamp fresh policy decisions", async () => {
  const storage = createDocumentStorage({
    owner: { workbenchId: "project", extensionId: "pstdio.published-extensions" },
    store: createMemoryDocumentStore(),
    assets: { verifyComplete: async () => {} } as never,
  });
  const extensionId = "fixture.tools";
  let policy: TeamExtensionPolicy[] = [
    {
      extensionId,
      selectionId: "required-decision",
      required: {
        extensionId,
        name: "Tools",
        version: "1.0.0",
        revision: "a".repeat(64),
        selectionId: "required-decision",
      },
    },
  ];
  const catalog = createPublicationCatalog({
    records: storage.records,
    verifyComplete: async () => {},
    readPolicy: async () => policy,
  });
  const asset = { sha256: "b".repeat(64), byteLength: 1, mediaType: "application/octet-stream" };
  const publication = { extensionId, version: "2.0.0", revision: asset.sha256, enabled: false };
  await expect(catalog.select(publication, asset)).rejects.toBeInstanceOf(AlwaysEnabledExtensionError);
  expect((await catalog.read(extensionId)).exists).toBe(false);

  policy = [{ extensionId, selectionId: "released-decision", required: null }];
  await catalog.select(publication, asset);
  expect((await catalog.records.read(extensionId)).value).toEqual({
    revision: asset.sha256,
    enabled: false,
    teamPolicyRevision: "released-decision",
  });
  expect((await catalog.read(extensionId)).value?.version).toBe("2.0.0");

  // A later owner decision invalidates earlier ordinary choices, including deletions.
  policy = [{ extensionId, selectionId: "next-release-decision", required: null }];
  await catalog.change(extensionId, undefined, ({ records }) =>
    records.commit({
      operationId: "explicit-removal",
      edits: [{ recordId: extensionId, deleted: true }],
    }),
  );
  const removed = await catalog.records.read(extensionId);
  expect(removed.deleted).toBe(true);
  expect((removed.value as { teamPolicyRevision: string }).teamPolicyRevision).toBe("next-release-decision");

  policy = [
    {
      extensionId,
      selectionId: "required-again",
      required: {
        extensionId,
        name: "Tools",
        version: "1.0.0",
        revision: "a".repeat(64),
        selectionId: "required-again",
      },
    },
  ];
  await expect(catalog.change(extensionId, undefined, async () => {})).rejects.toBeInstanceOf(
    AlwaysEnabledExtensionError,
  );
  await expect(
    catalog.select({ ...publication, extensionId: "fixture.replacement" }, asset, undefined, {
      extensionId,
      expectedRevision: removed.revision,
    }),
  ).rejects.toBeInstanceOf(AlwaysEnabledExtensionError);
});
