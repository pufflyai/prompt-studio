import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

test("authentication progress replaces empty content and accompanies history exactly once", () => {
  for (const history of [false, true]) {
    const progress = <div role="status">Complete browser sign-in</div>;
    const session = createChatSession({
      initial: {
        messages: history ? [{ id: "reply", role: "assistant", parts: [{ type: "text", text: "Saved reply" }] }] : [],
      },
      query: async () => ({}),
      action: async () => ({}),
    });
    const Host = ({ children }: NativeChatHostProps) =>
      children({
        account: {
          blocked: true,
          commands: [],
          assertReady() {},
          isCommand: () => false,
          submit: () => undefined,
          progress,
          setup: progress,
          notice: null,
        },
      });
    const html = renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <NativeChatView session={session} conversationKey="progress" action={undefined} Host={Host} />
      </WorkbenchThemeProvider>,
    );
    expect(html.match(/Complete browser sign-in/g)).toHaveLength(1);
    expect(html.includes("No messages yet")).toBe(false);
    expect(html.includes('data-testid="content-editable"')).toBe(true);
  }
});
