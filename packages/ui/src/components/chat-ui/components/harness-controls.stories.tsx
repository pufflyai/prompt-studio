import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AlertMessage } from "@/components/primitives/alert";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";
import { HarnessControls, type HarnessControlsProps } from "./harness-controls";

const meta: Meta<typeof HarnessControls> = {
  title: "Patterns/Chat/Harness Controls",
  component: HarnessControls,
  args: {
    modes: [],
    onAction: async () => {},
  },
};
export default meta;
type Story = StoryObj<typeof HarnessControls>;
const NewConversationComposer = (props: HarnessControlsProps) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(false);
  return (
    <ChatInput
      defaultState={createSerializedPromptState("")}
      onChange={setQuery}
      actions={
        <>
          <Button size="xs" variant="ghost">
            Model
          </Button>
          <HarnessControls
            {...props}
            modes={[]}
            draftTag={
              selected
                ? { label: "Goal", description: `Goal: ${query} · Draft`, onClose: () => setSelected(false) }
                : undefined
            }
          />
        </>
      }
      commands={[
        { name: "/goal", description: "Use this draft as the objective.", onSelect: () => setSelected(true) },
        { name: "/plan", description: "Select native planning.", disabledReason: "Leave the goal first." },
        { name: "/compact", description: "Compact this thread." },
      ]}
    />
  );
};
export const NewConversation: Story = {
  render: (args) => <NewConversationComposer {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox"), "Finish the release notes /go");
    const commands = await within(canvasElement.ownerDocument.body).findByRole("listbox", { name: "Harness commands" });
    await expect(commands).toBeVisible();
    await userEvent.click(within(commands).getByRole("option", { name: "/goal" }));
    await expect(canvas.getByRole("textbox").innerText.trim()).toBe("Finish the release notes");
    const goal = canvas.getByRole("button", { name: /Goal: Finish the release notes/ });
    await expect(goal).toHaveTextContent("Goal");
    await userEvent.hover(goal);
    await expect(await within(canvasElement.ownerDocument.body).findByRole("tooltip")).toHaveTextContent(
      /Finish the release notes/,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Remove Goal" }));
    await expect(canvas.getByRole("textbox").innerText.trim()).toBe("Finish the release notes");
  },
};
export const IndependentModes: Story = {
  render: (args) => (
    <ChatInput
      defaultState={createSerializedPromptState("Keep this unsent draft")}
      actions={<HarnessControls {...args} />}
    />
  ),
  args: {
    modes: [
      {
        id: "planning",
        label: "Plan",
        description: "Selected for the next turn.",
        state: "Next turn",
        closeActionId: "default",
        actions: [{ id: "default", label: "Leave planning" }],
      },
      {
        id: "goal",
        label: "Goal",
        description: "Finish the migration and verify the result.",
        state: "active · 1200 / 40000 tokens",
        tagText: "active: Finish the migration and verify the result.",
        closeActionId: "clear",
        actions: [
          { id: "pause", label: "Pause" },
          { id: "edit", label: "Edit", argument: { label: "Objective", value: "Finish the migration" } },
          { id: "clear", label: "Clear" },
        ],
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const goal = canvas.getByRole("button", { name: "Goal details" });
    await expect(goal).toHaveTextContent("Goal");
    goal.focus();
    await expect(await body.findByRole("tooltip")).toHaveTextContent(/Finish the migration/);
    await userEvent.click(goal);
    await userEvent.click(await body.findByRole("button", { name: "Edit" }));
    const objective = await body.findByRole("textbox", { name: "Objective" });
    await userEvent.clear(objective);
    await userEvent.type(objective, "Revised native objective");
    await userEvent.click(body.getByRole("button", { name: "Apply" }));
    await expect(canvas.getByRole("textbox").innerText).toBe("Keep this unsent draft");
  },
};
export const Pending: Story = { args: { ...IndependentModes.args, pending: true } };
export const StatusUnavailable: Story = { args: { ...IndependentModes.args, unavailable: true, onRefresh: () => {} } };
export const SentReference: Story = {
  args: {
    sentTag: {
      label: "Goal",
      description: "Finish the release notes · Native status is not confirmed. Closing hides this reference only.",
      onClose: () => {},
    },
    onRefresh: () => {},
  },
};
export const NativeError: Story = {
  render: (args) => (
    <>
      <AlertMessage status="error" title="Command not sent">
        This harness does not support this command. Your draft is ready to edit.
      </AlertMessage>
      <HarnessControls {...args} />
    </>
  ),
};
