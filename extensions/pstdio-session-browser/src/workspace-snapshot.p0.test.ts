import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { nativeSubmissionIndex } from "./native-submission";
import { readSnapshot } from "./snapshot";

const presentation = {
  controlId: "workspace",
  deviceControlId: "device",
  openResourceId: "a",
  additions: 12,
  deletions: 3,
};
const snapshotContext = () =>
  makeCommandContext({
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    params: {},
    projectId: "p",
    overrides: {
      account: { devices: async () => [] },
      extensions: {
        list: async () => {
          throw new Error("Presentation must not scan the extension inventory");
        },
        install: async () => {},
      },
      workspaces: { list: async () => [{ id: "a", name: "Workspace A", isDefault: true }] },
      commands: {
        execute: async () =>
          ({ ok: false, status: "error", code: "command_not_found", reason: "Workspaces not installed" }) as never,
      },
      sessions: {
        getExecutionState: async () => ({ kind: "local", available: true }),
        getConversation: async () => ({
          session: {
            id: "s",
            title: "Saved",
            status: "completed",
            agent: "agent",
            workspaceId: "a",
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
const resource = { type: "session", id: "s", extensionId: "pstdio", projectId: "p" };

test("absent or disabled Workspaces hides workspace information in drafts and saved sessions", async () => {
  for (const saved of [false, true]) {
    const ctx = snapshotContext();
    const snapshot = await readSnapshot(ctx, saved ? resource : undefined);
    expect(snapshot.controls?.some((control) => control.id === "workspace")).toBe(false);
    expect(snapshot.controls?.some((control) => control.id === "device")).toBe(true);
    expect(snapshot.workspace).toEqual({ controlId: "workspace", deviceControlId: "device" });
    expect(snapshot.workspaceId).toBe("a");
    expect(snapshot.values?.workspace).toBe("a");
  }
});

test("a failed optional workspace presentation leaves the transcript and device usable", async () => {
  const ctx = snapshotContext();
  ctx.commands.execute = () => {
    throw new Error("Workspaces failed to load");
  };
  const snapshot = await readSnapshot(ctx, resource);
  expect(snapshot.messages).toEqual([]);
  expect(snapshot.workspace).toEqual({ controlId: "workspace", deviceControlId: "device" });
  expect(snapshot.controls?.some((control) => control.id === "device")).toBe(true);
});

test("available Workspaces supplies header presentation without changing execution", async () => {
  const ctx = snapshotContext();
  ctx.commands.execute = async (command, invocation) => {
    expect(command).toEqual({ kind: "command", extensionId: "pstdio.pstdio-workspaces", id: "session-presentation" });
    expect(invocation.params).toMatchObject({ id: "a", available: true });
    return { ok: true, status: "success", value: presentation } as never;
  };
  for (const saved of [false, true]) {
    const snapshot = await readSnapshot(ctx, saved ? resource : undefined);
    expect(snapshot.controls?.some((control) => control.id === "workspace")).toBe(true);
    expect(snapshot.workspace).toEqual(presentation);
    expect(snapshot.workspaceId).toBe("a");
  }
});
