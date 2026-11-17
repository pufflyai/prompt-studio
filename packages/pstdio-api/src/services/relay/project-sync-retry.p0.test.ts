import { expect, test } from "bun:test";
import { createProjectSyncRetry } from "./project-sync-retry";

test("an empty selected source is rejected without retrying the project; omission still retries all sources", async () => {
  const calls: string[] = [];
  const source = (name: string) => ({
    retry: () => {
      calls.push(`${name}:retry`);
    },
    restart: async () => {
      calls.push(`${name}:restart`);
    },
  });
  const core = source("core");
  const extension = { ...source("extension"), owner: { workbenchId: "project", extensionId: "example.files" } };
  const retry = createProjectSyncRetry({
    refresh: async () => {},
    owners: { core: { get: () => core } },
    folders: { get: () => source("folders") },
    extensions: new Map([[JSON.stringify(["project", "example.files"]), extension]]),
  });
  await expect(retry("project", "")).rejects.toThrow("Unknown Cloud sync source");
  expect(calls).toEqual([]);
  await retry("project", "example.files");
  expect(calls).toEqual(["extension:restart"]);
  calls.length = 0;
  await retry("project");
  expect(calls).toEqual(["core:retry", "folders:retry", "extension:retry"]);
});
