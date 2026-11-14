import { expect, test } from "bun:test";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

const allowAndDeny = [
  { id: "approve", label: "Allow" },
  { id: "deny", label: "Deny" },
];

const renderPanel = (choices = allowAndDeny) => {
  const actions: unknown[] = [];
  const session = createChatSession({
    initial: {
      approval: {
        id: "approval-1",
        title: "Allow Bash to run: git status",
        choices,
      },
    },
    query: async () => ({}),
    action: async (action) => {
      actions.push(action);
      return {};
    },
  });
  session.changeDraft({ text: "Keep unsent" });
  let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
  const Host = ({ children }: NativeChatHostProps) => {
    panel = children({}) as typeof panel;
    return null;
  };
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatView session={session} action={undefined} conversationKey="approval" Host={Host} />
    </WorkbenchThemeProvider>,
  );
  return { panel, actions, session };
};

test("a tool approval asks in the composer question form", () => {
  const { panel } = renderPanel();
  expect(panel.props.chatInputQuestionPrompt?.questions).toEqual([
    {
      question: "Allow Bash to run: git status",
      options: [{ label: "Allow" }, { label: "Deny" }],
      required: true,
    },
  ]);
});

test("answering an approval sends the chosen decision without submitting the draft", async () => {
  const { panel, actions, session } = renderPanel();
  const prompt = panel.props.chatInputQuestionPrompt!;
  await panel.props.onSubmitMessage?.("Allow", [], { answers: [["Allow"]], callId: prompt.callId });
  expect(actions).toEqual([{ type: "approve", id: "approval-1", choice: "approve" }]);
  expect(session.getSnapshot().draft.text).toBe("Keep unsent");
});

test("skipping an approval denies the tool", async () => {
  const { panel, actions } = renderPanel();
  const prompt = panel.props.chatInputQuestionPrompt!;
  await panel.props.onSubmitMessage?.("Skipped", [], { answers: [], callId: prompt.callId });
  expect(actions).toEqual([{ type: "approve", id: "approval-1", choice: "deny" }]);
});

test("skipping an approval that offers no Deny choice says why nothing was sent", async () => {
  const { panel, actions, session } = renderPanel([{ id: "allow", label: "Allow" }]);
  const prompt = panel.props.chatInputQuestionPrompt!;
  await expect(panel.props.onSubmitMessage?.("Skipped", [], { answers: [], callId: prompt.callId })).rejects.toThrow();
  expect(actions).toEqual([]);
  expect(session.getSnapshot().error).toBeTruthy();
});
