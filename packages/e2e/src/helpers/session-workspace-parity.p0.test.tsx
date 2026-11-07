import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { nativeSubmissionIndex } from "../../../../extensions/pstdio-session-browser/src/native-submission";
import { readSnapshot } from "../../../../extensions/pstdio-session-browser/src/snapshot";
import { NativeChatWorkspace } from "../../../pstdio-workbench/src/react/renderers/chat/native-chat-workspace";
import { WorkbenchThemeProvider } from "../../../pstdio-workbench/src/react/theme/workbench-theme-provider";

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
const renderSnapshot = async (
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
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatWorkspace
        conversation={snapshot}
        draft={{ text: "Keep draft", attachments: [], values: snapshot.values ?? {} }}
        run={async () => ({})}
        changeValues={() => {}}
      />
    </WorkbenchThemeProvider>,
  );
  return {
    snapshot,
    open: markup.includes('aria-label="Open workspace"'),
    selector: markup.includes('aria-label="Select workspace"'),
  };
};

test("real Sessions draft defaults never offer Open; saved snapshots require an available selected workspace", async () => {
  const workspaces = [{ id: "a", name: "Workspace A", isDefault: true }];
  const draft = await renderSnapshot(false, null, workspaces);
  expect(draft.snapshot.values?.workspace).toBe("a");
  expect(draft.open).toBe(false);
  expect(draft.selector).toBe(true);
  expect((await renderSnapshot(false, null, workspaces, "unknown")).open).toBe(false);
  expect((await renderSnapshot(false, null, [])).open).toBe(false);
  expect((await renderSnapshot(true, "a", workspaces)).open).toBe(true);
  expect((await renderSnapshot(true, null, workspaces)).open).toBe(false);
  expect((await renderSnapshot(true, "missing", workspaces)).open).toBe(false);
});
