import { expect, test } from "bun:test";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

test("native reply fork dispatches the selected completed message ID to its provider", async () => {
  const actions: unknown[] = [];
  const session = createChatSession({
    initial: {
      messages: [{ id: "reply", role: "assistant", parts: [{ type: "text", text: "Completed reply" }] }],
      fork: { disabledReason: null },
    },
    query: async () => ({}),
    action: async (action) => {
      actions.push(action);
      return {};
    },
  });
  let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
  const Host = ({ children }: NativeChatHostProps) => {
    panel = children({}) as typeof panel;
    return panel;
  };
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatView session={session} Host={Host} conversationKey="saved" action={undefined} />
    </WorkbenchThemeProvider>,
  );
  expect(panel.props.messages).toMatchObject([{ id: "reply", role: "assistant" }]);
  expect(panel.props.onForkMessage).toBeFunction();
  expect(panel.props.forkDisabledReason).toBeUndefined();
  await panel.props.onForkMessage!("reply");
  expect(actions).toEqual([{ type: "fork", messageId: "reply" }]);
});
