import { expect, test } from "bun:test";
import type { ProjectFolderRecoveryStatus } from "pstdio-api-contracts";
import type { Arguments } from "yargs";
import { createHandler, type RestoreArgs } from "./restore";
import type { FolderCommandDeps } from "./wait";

const source = { deviceId: "laptop", sourceId: "workspace" };
const status = (restore: Partial<ProjectFolderRecoveryStatus["restore"]>, files = 0): ProjectFolderRecoveryStatus => ({
  capture: { state: "idle", folder: null, error: null },
  download: { state: "complete", source, bytes: { completed: 10, total: null }, error: null },
  restore: {
    state: "running",
    source,
    destination: "/new",
    bytes: { completed: files * 5, total: 10 },
    files: { completed: files, total: 2 },
    error: null,
    result: null,
    ...restore,
  },
});
const args = { _: [], $0: "", id: "project", device: "laptop", source: "workspace", path: "/new", wait: true };

const fixture = (responses: ProjectFolderRecoveryStatus[]) => {
  const output: string[] = [];
  const progress: string[] = [];
  const calls: string[] = [];
  let failed = false;
  let interrupt: (() => Promise<void>) | undefined;
  const deps: FolderCommandDeps = {
    projects: () => ({
      restoreFolder: async (_id, input) => {
        calls.push(`restore ${JSON.stringify(input)}`);
        return responses.shift()!;
      },
      folderRecovery: async () => responses.shift()!,
      downloadFolder: async () => responses.shift()!,
      cancelFolderRecovery: async () => {
        calls.push("cancel");
        return responses[0]!;
      },
    }),
    cwd: () => "/caller",
    log: (text) => output.push(text),
    progress: (text) => progress.push(text),
    sleep: async () => {},
    interrupted: (cancel) => {
      interrupt = cancel;
      return () => {
        interrupt = undefined;
      };
    },
    failed: () => {
      failed = true;
    },
  };
  return { deps, output, progress, calls, failed: () => failed, interrupt: () => interrupt?.() };
};

test("restore prints the API's own final progress and reports progress until it completes", async () => {
  const complete = status(
    { state: "complete", result: { path: "/new", attached: true, git: "none", rewritten: [], omitted: [] } },
    2,
  );
  const run = fixture([status({}), status({}, 1), complete]);
  await createHandler(run.deps)(args as Arguments<RestoreArgs>);
  expect(run.calls).toEqual([`restore ${JSON.stringify({ deviceId: "laptop", sourceId: "workspace", path: "/new" })}`]);
  expect(JSON.parse(run.output.join(""))).toEqual(complete);
  expect(run.progress).toEqual(["restore: 0/2 files, 0/10 bytes", "restore: 1/2 files, 5/10 bytes"]);
  expect(run.failed()).toBe(false);
});

test("a failed or interrupted restore prints its actionable error and exits unsuccessfully", async () => {
  const error = { code: "destination_created" as const, message: "Another program created this folder.", path: null };
  const failedRun = fixture([status({}), status({ state: "failed", error })]);
  await createHandler(failedRun.deps)(args as Arguments<RestoreArgs>);
  expect(JSON.parse(failedRun.output.join("")).restore.error).toEqual(error);
  expect(failedRun.progress.at(-1)).toBe(error.message);
  expect(failedRun.failed()).toBe(true);

  const cancelled = status({ state: "cancelled", error: { code: "cancelled", message: "Cancelled.", path: null } });
  const interrupted = fixture([status({}), cancelled]);
  interrupted.deps.sleep = async () => {
    await interrupted.interrupt();
  };
  await createHandler(interrupted.deps)(args as Arguments<RestoreArgs>);
  expect(interrupted.calls.at(-1)).toBe("cancel");
  expect(JSON.parse(interrupted.output.join("")).restore.state).toBe("cancelled");
  expect(interrupted.failed()).toBe(true);
});

test("a relative restore path is the caller's folder, and a home path stays for the host to expand", async () => {
  const complete = status(
    {
      state: "complete",
      result: { path: "/caller/restored", attached: true, git: "none", rewritten: [], omitted: [] },
    },
    2,
  );
  for (const [path, expected] of [
    ["restored", "/caller/restored"],
    ["../elsewhere", "/elsewhere"],
    ["~/restored", "~/restored"],
  ]) {
    const run = fixture([complete]);
    await createHandler(run.deps)({ ...args, path, wait: false } as Arguments<RestoreArgs>);
    expect(run.calls).toEqual([
      `restore ${JSON.stringify({ deviceId: "laptop", sourceId: "workspace", path: expected })}`,
    ]);
  }
});
