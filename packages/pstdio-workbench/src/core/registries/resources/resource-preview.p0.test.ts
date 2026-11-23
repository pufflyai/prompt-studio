import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "../mutations/operations";
import { createResourcePreview, resolveResourcePreview } from "./resource-preview";
import { createResourceRegistry } from "./resource-registry";

const resource = { type: "note", id: "one", extensionId: "notes", projectId: "project", label: "Original" };
test("shows a rename immediately and keeps it until the authoritative refresh completes", async () => {
  const previews = createResourcePreview();
  let release!: () => void;
  previews.subscribeRefresh(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const change = previews.begin(resource, { label: "Renamed" });
  expect(previews.resolve(resource)?.label).toBe("Renamed");
  const commit = change.commit();
  expect(previews.resolve(resource)?.label).toBe("Renamed");
  release();
  await commit;
  expect(previews.resolve({ ...resource, label: "Saved" })?.label).toBe("Saved");
});
test("rolls back only the failed intent and isolates resources by owner and project", () => {
  const previews = createResourcePreview();
  const first = previews.begin(resource, { label: "First" });
  const second = previews.begin(resource, { label: "Second" });
  first.rollback();
  expect(previews.resolve(resource)?.label).toBe("Second");
  expect(previews.resolve({ ...resource, extensionId: "other" })?.label).toBe("Original");
  second.rollback();
  expect(previews.resolve(resource)?.label).toBe("Original");
  const deletion = previews.begin(resource, { removed: true });
  expect(previews.resolve(resource)).toBeUndefined();
  deletion.rollback();
  expect(previews.resolve(resource)?.label).toBe("Original");
});

test("projects immutable preview snapshots without changing the resource identity", () => {
  const previews = createResourcePreview();
  const before = previews.store.getState().changes;
  const rename = previews.begin(resource, { label: "New" });
  const after = previews.store.getState().changes;
  expect(resolveResourcePreview(resource, before)).toEqual(resource);
  expect(resolveResourcePreview(resource, after)).toEqual({ ...resource, label: "New" });
  rename.rollback();
  expect(resolveResourcePreview(resource, after)?.label).toBe("New");
  expect(resolveResourcePreview(resource, previews.store.getState().changes)).toEqual(resource);
});

test("restores an uncertain removal until a peer observes the exact resource removed", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const preview = createResourcePreview(operations);
  const peer = createResourceRegistry({ preview: createResourcePreview(operations) });
  const lost = new PstdioConnectionError(new Error("Response lost"));
  const attempt = preview.submit(
    resource,
    async () => {
      throw lost;
    },
    { removed: true },
    "Delete note",
  );
  expect(preview.resolve(resource)).toBeUndefined();
  await expect(attempt).rejects.toBe(lost);
  expect(preview.resolve(resource)).toEqual(resource);
  const entry = operations.getSnapshot().recovery[0];
  expect(entry).toMatchObject({
    status: "unknown",
    canCheck: true,
    source: resource,
    draft: { id: "one", type: "note" },
  });
  peer.removed({ ...resource, id: "another" });
  await operations.check(entry.id);
  expect(operations.getSnapshot().recovery).toHaveLength(1);
  peer.removed(resource);
  await Bun.sleep(0);
  expect(operations.getSnapshot().recovery).toEqual([]);
});
