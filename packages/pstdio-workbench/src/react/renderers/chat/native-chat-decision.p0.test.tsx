import { expect, test } from "bun:test";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

test("a native decision keeps harness details and current settings available without submitting the unsent draft", async () => {
  const actions: unknown[] = [];
  const session = createChatSession({
    initial: {
      harness: {
        commands: [],
        slashCommands: true,
        modes: [
          { id: "plan", label: "Plan", description: "Revised workflow", state: "Awaiting approval", actions: [] },
        ],
      },
      decision: {
        id: "plan-revision",
        model: "saved-model",
        actions: [{ id: "continue", label: "Continue planning", variant: "subtle" }],
      },
    },
    query: async () => ({}),
    action: async (action) => {
      actions.push(action);
      return {};
    },
  });
  session.changeDraft({
    text: "Keep unsent",
    values: { provider: { harnessId: "native-modes", model: "saved-model" } },
  });
  let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
  const Host = ({ children }: NativeChatHostProps) => {
    panel = children({}) as typeof panel;
    return null;
  };
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatView session={session} action={undefined} conversationKey="decision" Host={Host} />
    </WorkbenchThemeProvider>,
  );
  const decision = panel.props.composerDecision!;
  const markup = renderToStaticMarkup(<WorkbenchThemeProvider>{decision.controls}</WorkbenchThemeProvider>);
  expect(markup).toContain('aria-label="Harness controls"');
  expect(markup).toContain('aria-label="Plan details"');
  await decision.onAction("continue");
  expect(actions).toMatchObject([
    { type: "decision", id: "plan-revision", actionId: "continue", values: { provider: { model: "saved-model" } } },
  ]);
  expect(session.getSnapshot().draft.text).toBe("Keep unsent");
});
