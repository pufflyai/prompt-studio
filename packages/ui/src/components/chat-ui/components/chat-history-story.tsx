import { Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

export const PromptHistoryPanel = () => {
  const [messages, setMessages] = useState<SessionMessage[]>([
    { id: "first", role: "user", parts: [{ type: "text", text: "Explain the project" }] },
    { id: "second", role: "user", parts: [{ type: "text", text: "Show the next steps" }] },
    { id: "third", role: "user", parts: [{ type: "text", text: "Summarize the plan" }] },
  ]);
  return (
    <Box w="full" h="600px">
      <ChatPanel
        conversationKey="prompt-history"
        messages={messages}
        emptyStateTitle="Start a conversation"
        emptyStateDescription="Send a prompt"
        chatInputPlaceholder="Use Arrow Up to recall a prompt"
        onSubmitMessage={(text) =>
          setMessages((current) => [
            ...current,
            { id: String(current.length), role: "user", parts: [{ type: "text", text }] },
          ])
        }
      />
    </Box>
  );
};

const focusEditor = (canvasElement: HTMLElement) =>
  waitFor(async () => {
    const editor = canvasElement.querySelector<HTMLElement>('[contenteditable="true"]')!;
    await userEvent.click(editor);
    await expect(editor).toHaveFocus();
    return editor;
  });

export const walkThreePrompts = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const editor = await focusEditor(canvasElement);
  for (const modifier of ["Control", "Meta", "Shift", "Alt"]) {
    await userEvent.keyboard(`{${modifier}>}{ArrowUp}{/${modifier}}`);
    await expect(editor.textContent).toBe("");
  }
  for (const text of ["Summarize the plan", "Show the next steps", "Explain the project"]) {
    await userEvent.keyboard("{ArrowUp}");
    await expect(editor).toHaveTextContent(text);
  }
  await userEvent.keyboard("{ArrowUp}");
  await expect(editor).toHaveTextContent("Explain the project");
  await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
  await expect(editor.textContent).toBe("");
  await userEvent.keyboard("{ArrowUp}");
  await userEvent.paste(" revised");
  await userEvent.keyboard("{ArrowUp}");
  await expect(editor).toHaveTextContent("Summarize the plan revised");
};

export const walkTenPrompts = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const editor = await focusEditor(canvasElement);
  for (let i = 0; i < 12; i++) await userEvent.keyboard("{ArrowUp}");
  await expect(editor).toHaveTextContent("Prompt 3");
  for (let i = 0; i < 10; i++) await userEvent.keyboard("{ArrowDown}");
  await expect(editor.textContent).toBe("");
};

export const keepDraft = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const editor = await focusEditor(canvasElement);
  await userEvent.paste("First line\nSecond line");
  await userEvent.keyboard("{ArrowUp}{ArrowDown}");
  await expect(editor).toHaveTextContent("First line");
  await expect(editor).toHaveTextContent("Second line");
};

export const suppressRecall = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const editor = await focusEditor(canvasElement);
  await userEvent.keyboard("{ArrowUp}");
  await expect(editor.textContent).toBe("");
};

export const PromptHistoryResetPanel = () => {
  const [conversation, setConversation] = useState(0);
  const [prompt, setPrompt] = useState("Original prompt");
  return (
    <Box w="full" h="600px">
      <Button onClick={() => setConversation((value) => value + 1)}>Switch conversation</Button>
      <Button onClick={() => setPrompt("Updated prompt")}>Update history</Button>
      <ChatPanel
        conversationKey={String(conversation)}
        messages={[{ id: "same-first-message", role: "user", parts: [{ type: "text", text: prompt }] }]}
        emptyStateTitle="Start a conversation"
        emptyStateDescription="Send a prompt"
        chatInputPlaceholder="Use Arrow Up to recall a prompt"
      />
    </Box>
  );
};

export const resetHistoryWalk = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const canvas = within(canvasElement);
  const editor = () => canvasElement.querySelector<HTMLElement>('[contenteditable="true"]')!;
  await userEvent.click(editor());
  await userEvent.keyboard("{ArrowUp}");
  await expect(editor()).toHaveTextContent("Original prompt");
  await userEvent.click(canvas.getByRole("button", { name: "Switch conversation" }));
  await expect(editor().textContent).toBe("");
  await userEvent.click(editor());
  await userEvent.keyboard("{ArrowUp}");
  await userEvent.click(canvas.getByRole("button", { name: "Update history" }));
  await userEvent.click(editor());
  await userEvent.keyboard("{ArrowDown}");
  await expect(editor()).toHaveTextContent("Original prompt");
};
