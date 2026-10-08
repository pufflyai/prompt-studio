import { expect, test } from "bun:test";
import { createResourcePreview } from "./resource-preview";

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
