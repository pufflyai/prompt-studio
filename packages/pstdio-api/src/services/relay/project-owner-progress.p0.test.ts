import { expect, test } from "bun:test";
import { projectOwnerProgress } from "./project-owner-progress";
import { createProjectSyncRetry } from "./project-sync-retry";

test("Cloud progress identifies Activity, personal history and extensions independently when retrying a source", async () => {
  const ready = {
    firstDownloaded: true,
    downloaded: true,
    pending: false,
    needsAttention: false,
    connected: true,
    busy: false,
    canRetry: true,
  };
  const progress = projectOwnerProgress(
    "project",
    [ready, ready, ready, { ...ready, downloaded: false, error: "Activity download interrupted" }, ready, ready],
    ["example.notes"],
    ["Notes"],
  );
  expect(progress.sources.map(({ id, name }) => ({ id, name }))).toEqual([
    { id: "core", name: "Project information" },
    { id: "publications", name: "Extensions" },
    { id: "automations", name: "Automations" },
    { id: "activity", name: "Activity" },
    { id: "personal", name: "Sessions and history" },
    { id: "example.notes", name: "Notes" },
  ]);
  const failed = progress.sources.find((source) => source.error);
  expect(failed).toMatchObject({ id: "activity", canRetry: true, downloaded: false });

  const calls: string[] = [];
  const owner = (id: string) => ({
    get: () => ({
      retry: () => calls.push(`${id}:retry`),
      restart: async () => {
        calls.push(`${id}:restart`);
      },
    }),
  });
  const retry = createProjectSyncRetry({
    refresh: async () => {},
    owners: {
      core: owner("core"),
      publications: owner("publications"),
      automations: owner("automations"),
      activity: owner("activity"),
      personal: owner("personal"),
    },
    folders: { get: () => undefined },
    extensions: new Map(),
  });
  await retry("project", failed!.id);
  expect(calls).toEqual(["activity:restart"]);
});
