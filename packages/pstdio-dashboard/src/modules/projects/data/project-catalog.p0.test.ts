import { expect, test } from "bun:test";
import type { CloudProjectCatalog } from "@pstdio/sdk/client";
import { mergeCloudProjectCatalog } from "./project-data";

test("merges device rows, Cloud only projects, and unfinished deletion receipts by identity", () => {
  const catalog: CloudProjectCatalog = {
    projects: [
      {
        id: "downloaded",
        name: "Downloaded",
        presence: "downloaded",
        online: true,
        actions: { download: false, removeLocal: true, deleteCloud: true },
      },
      {
        id: "cloud",
        name: "Cloud only",
        presence: "cloud-only",
        online: false,
        actions: { download: false, removeLocal: false, deleteCloud: false },
      },
    ],
    deletions: [
      {
        projectId: "deleting",
        name: "Deletion in progress",
        operationId: "operation",
        state: "deleting",
        startedAt: "2026-11-18T10:00:00Z",
        completedAt: null,
      },
    ],
  };
  const [downloaded, cloud, deleting] = mergeCloudProjectCatalog(
    mergeCloudProjectCatalog([], {
      projects: [catalog.projects[0]!],
      deletions: [],
    }),
    catalog,
  );
  expect(downloaded).toMatchObject({ id: "downloaded", catalog: { presence: "downloaded" } });
  expect(cloud).toMatchObject({ id: "cloud", folderPath: null, catalog: { presence: "cloud-only" } });
  expect(deleting).toMatchObject({ id: "deleting", deletion: { operationId: "operation" } });
});
