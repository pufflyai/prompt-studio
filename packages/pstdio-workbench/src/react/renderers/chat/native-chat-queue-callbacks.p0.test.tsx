import { expect, test } from "bun:test";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

const capture = () => {
  const actions: unknown[] = [];
  const session = createChatSession({
    query: async () => ({}),
    action: async (action) => {
      actions.push(action);
      return {};
    },
  });
  let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
  const Host = ({ children }: NativeChatHostProps) => {
    panel = children({}) as typeof panel;
    return null;
  };
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatView session={session} action={undefined} conversationKey="queue" Host={Host} />
    </WorkbenchThemeProvider>,
  );
  return { session, actions, callbacks: panel.props };
};

for (const operation of ["remove", "move"] as const) {
  test(`a stale native queue ${operation} reports its missing request without escaping the callback`, async () => {
    const { callbacks, session, actions } = capture();
    expect(() => {
      if (operation === "remove") callbacks.onQueuedFollowUpRemove!("gone");
      else callbacks.onQueuedFollowUpMove!("gone", "up", 1);
    }).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(session.getSnapshot().error).toBe("The queued request is no longer available.");
    expect(actions).toEqual([]);
  });
}

test("native queue move preserves the captured request revision after its live row disappears", async () => {
  const { callbacks, actions } = capture();
  const source = {
    id: "gone",
    prompt: "Captured",
    revision: "saved-revision",
    model: "B",
    params: { thinking: "high" },
  };
  callbacks.onQueuedFollowUpMove!(source.id, "up", 1, { source, items: [source] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(actions).toMatchObject([{ type: "queue", operation: "move", item: source, direction: "up", steps: 1 }]);
});
