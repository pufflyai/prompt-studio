import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "../../../../extensions/pstdio-session-browser/src/actions";
import { nativeSubmissionIndex } from "../../../../extensions/pstdio-session-browser/src/native-submission";
import { readSnapshot } from "../../../../extensions/pstdio-session-browser/src/snapshot";
import { createChatSession } from "../../../pstdio-workbench/src/extensions/contributions/chat-session";
import type { NativeChatHostProps } from "../../../pstdio-workbench/src/react/renderers/chat/native-chat-host";
import { NativeChatView } from "../../../pstdio-workbench/src/react/renderers/chat/native-chat-view";
import { WorkbenchThemeProvider } from "../../../pstdio-workbench/src/react/theme/workbench-theme-provider";

test("actual saved-session snapshot supplies reply fork and native dispatch preserves its completed message ID", async () => {
  const forks: unknown[] = [];
  const navigation: unknown[] = [];
  const saved = { id: "source", title: "Saved", status: "completed", agent: "fixture", params: {}, workspaceId: null };
  const reply = {
    id: "completed-assistant",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "Completed reply" }],
  };
  const ctx = makeCommandContext({
    params: {},
    projectId: "p",
    storage: createMemoryStorage({ indexes: [nativeSubmissionIndex] }),
    overrides: {
      workspaces: { list: async () => [] },
      account: { devices: async () => [] },
      navigation: {
        open: (target) => {
          navigation.push(target);
        },
      },
      sessions: {
        getExecutionState: async () => ({ kind: "local", available: true }),
        getConversation: async () => ({ session: saved, messages: [reply] }) as never,
        getQueuedMessages: async () => ({
          messages: [],
          queue: { requests: [], activeRunStartedAt: null, steeringAvailable: true, steeringUnavailableReason: null },
        }),
        getHarnessCommands: async () => ({ harnessId: "fixture", commands: [], modes: [], slashCommands: true }),
        getForkState: async () => {
          throw new Error("The host reply action must not depend on native harness fork discovery.");
        },
        fork: async (...args) => {
          forks.push(args);
          return { ...saved, id: "forked" } as never;
        },
      },
    },
  });
  const renderer = {
    rendererId: "conversation",
    resource: { type: "session", id: "source", extensionId: "pstdio", projectId: "p" },
  };
  const snapshot = await readSnapshot(ctx, renderer.resource);
  const session = createChatSession({
    initial: snapshot,
    query: async () => ({}),
    action: (action) => act(ctx, { renderer, action, draftKey: "source" }),
  });
  let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
  const Host = ({ children }: NativeChatHostProps) => {
    panel = children({}) as typeof panel;
    return panel;
  };
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatView session={session} Host={Host} conversationKey="source" action={undefined} />
    </WorkbenchThemeProvider>,
  );
  expect(panel.props.messages).toMatchObject([{ id: "completed-assistant", role: "assistant" }]);
  expect(panel.props.onForkMessage).toBeFunction();
  expect(panel.props.forkDisabledReason).toBeUndefined();
  await panel.props.onForkMessage!(reply.id);
  expect(forks).toEqual([["source", "completed-assistant"]]);
  expect(navigation).toMatchObject([{ kind: "page", resource: { id: "forked", extensionId: "pstdio" } }]);
});
