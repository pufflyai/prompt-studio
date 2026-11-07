import { expect, test } from "bun:test";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

test("native prompt recall includes accepted queue receipts without adding transcript rows", async () => {
  const first = { id: "first", role: "user" as const, parts: [{ type: "text" as const, text: "First" }] };
  const session = createChatSession({
    initial: { streaming: true, messages: [first] },
    query: async () => ({}),
    action: async () => ({}),
  });
  await session.run({ type: "submit", text: "Follow-up", values: {}, attachments: [] });
  let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
  const Host = ({ children }: NativeChatHostProps) => {
    panel = children({}) as typeof panel;
    return null;
  };
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatView session={session} action={undefined} conversationKey="recall" Host={Host} />
    </WorkbenchThemeProvider>,
  );
  expect(panel.props.messages).toHaveLength(1);
  expect(panel.props.queuedFollowUps).toMatchObject([{ prompt: "Follow-up" }]);
  expect(panel.props.historyMessages).toMatchObject([
    first,
    { role: "user", parts: [{ type: "text", text: "Follow-up" }] },
  ]);
});
