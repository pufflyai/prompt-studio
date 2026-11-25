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

test("project retry acknowledges scheduling and exposes completion of the owned work", async () => {
  const pass = Promise.withResolvers<void>();
  let attempts = 0;
  const retry = createProjectSyncRetry({
    refresh: async () => {},
    owners: {
      core: {
        get: () => ({
          retry() {
            attempts++;
            return pass.promise;
          },
          restart: async () => {},
        }),
      },
    },
    folders: { get: () => undefined },
    extensions: new Map(),
  });
  await expect(
    retry("project", undefined, async () => {
      throw new Error("Account changed");
    }),
  ).rejects.toThrow("Account changed");
  expect(attempts).toBe(0);
  const scheduled = await retry("project");
  expect(attempts).toBe(1);
  let settled = false;
  const completion = scheduled!.settled.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  pass.resolve();
  await completion;
  expect(settled).toBe(true);
});
