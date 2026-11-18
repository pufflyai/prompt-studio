import { expect, test } from "bun:test";
import { localRemovalPreflight } from "./local-removal-preflight";

const project = { id: "notes", name: "Notes" };
const sync = { state: "synced", offlineReady: true } as const;

test("a synced record stream cannot verify the files in an app-managed folder", () => {
  const summary = { removesManagedFolder: true, providerWorkspaceCount: 0 };
  expect(localRemovalPreflight(project, summary, sync, true)).toMatchObject({
    uploadState: "unknown",
    requiresDiscard: true,
  });
});

test("verified record sync allows removing a copy whose source folder will be kept", () => {
  const summary = { removesManagedFolder: false, providerWorkspaceCount: 0 };
  expect(localRemovalPreflight(project, summary, sync, true)).toMatchObject({
    uploadState: "verified",
    requiresDiscard: false,
  });
  expect(localRemovalPreflight(project, summary, sync, false)).toMatchObject({
    uploadState: "unknown",
    requiresDiscard: true,
  });
});
