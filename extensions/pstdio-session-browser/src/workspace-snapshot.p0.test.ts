import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { nativeSubmissionIndex } from "./native-submission";
import { readSnapshot } from "./snapshot";

const snapshotContext = (workspaceId: string | null, workspaces: { id: string; name: string; isDefault?: boolean }[]) =>
  makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    projectId: "p",
    overrides: {
      account: { devices: async () => [] },
      workspaces: { list: async () => workspaces },
      sessions: {
        getExecutionState: async () => ({ kind: "local", available: true }),
        getConversation: async () => ({
          session: {
            id: "s",
            title: "Saved",
            status: "completed",
            agent: "agent",
            workspaceId,
            params: {},
            lastSelectedModel: null,
          } as never,
          messages: [],
        }),
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: false, steeringUnavailableReason: null },
        }),
        getHarnessCommands: async () => ({ harnessId: "agent", commands: [], modes: [], slashCommands: true }),
        getForkState: async () => ({ supported: false, disabledReason: null }),
      },
    },
  });
const snapshotFor = async (
  saved: boolean,
  workspaceId: string | null,
  workspaces: { id: string; name: string; isDefault?: boolean }[],
  selected?: string,
) => {
  const snapshot = await readSnapshot(
    snapshotContext(workspaceId, workspaces),
    saved ? { type: "session", id: "s", extensionId: "pstdio", projectId: "p" } : undefined,
    selected === undefined ? undefined : { workspace: selected },
  );
  return snapshot;
};

test("draft snapshots select a workspace while only saved available workspaces expose Open", async () => {
  const workspaces = [{ id: "a", name: "Workspace A", isDefault: true }];
  const draft = await snapshotFor(false, null, workspaces);
  expect(draft.values?.workspace).toBe("a");
  expect(draft.workspace?.openResourceId).toBeUndefined();
  expect(draft.controls).toContainEqual(expect.objectContaining({ id: "workspace", type: "selection" }));
  expect((await snapshotFor(false, null, workspaces, "unknown")).workspace?.openResourceId).toBeUndefined();
  expect((await snapshotFor(false, null, [])).workspace?.openResourceId).toBeUndefined();
  expect((await snapshotFor(true, "a", workspaces)).workspace?.openResourceId).toBe("a");
  expect((await snapshotFor(true, null, workspaces)).workspace?.openResourceId).toBeUndefined();
  expect((await snapshotFor(true, "missing", workspaces)).workspace?.openResourceId).toBeUndefined();
});
