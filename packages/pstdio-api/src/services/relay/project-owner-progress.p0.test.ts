import { expect, test } from "bun:test";
import { projectOwnerProgress } from "./project-owner-progress";

test("Activity has its own retryable sync source without shifting personal or extension identities", () => {
  const ready = {
    firstDownloaded: true,
    downloaded: true,
    pending: false,
    needsAttention: false,
    connected: true,
    busy: false,
    canRetry: true,
  };
  const result = projectOwnerProgress(
    "project",
    Array.from({ length: 6 }, () => ready),
    ["example.files"],
    ["Files"],
  );
  expect(result.sources?.map((source) => ({ id: source.id, name: source.name, canRetry: source.canRetry }))).toEqual([
    { id: "core", name: "Project information", canRetry: true },
    { id: "publications", name: "Extensions", canRetry: true },
    { id: "automations", name: "Automations", canRetry: true },
    { id: "activity", name: "Resource Activity", canRetry: true },
    { id: "personal", name: "Sessions and history", canRetry: true },
    { id: "example.files", name: "Files", canRetry: true },
  ]);
});
