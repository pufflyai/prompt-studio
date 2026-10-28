import { CloseButton, Dialog } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ParamEditorLabel } from "./param-editor-label";

const meta = {
  title: "Patterns/Param Editor/Label",
  component: ParamEditorLabel,
  args: {
    name: "Workspace type",
    description:
      "Create an isolated branch. Git review and merge cover the entire repository, including paths outside the project folder.",
  },
} satisfies Meta<typeof ParamEditorLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithInformation: Story = {
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("img", { name: "About Workspace type" });
    await user.tab();
    await waitFor(() => expect(canvas.getByRole("tooltip")).toBeVisible());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("tooltip")).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};
export const Compact: Story = { args: { compact: true } };
export const WithoutInformation: Story = { args: { description: undefined } };
export const InformationInDialog: Story = {
  decorators: [
    (Story) => (
      <Dialog.Root
        defaultOpen
        size="sm"
        scrollBehavior="inside"
        initialFocusEl={() => document.querySelector<HTMLButtonElement>('[aria-label="Close workspace dialog"]')}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Create workspace</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Story />
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close workspace dialog" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    const page = within(canvasElement.ownerDocument.body);
    const trigger = page.getByRole("img", { name: "About Workspace type" });
    await waitFor(() => expect(page.getByRole("dialog", { name: "Create workspace" })).toHaveStyle({ opacity: "1" }));
    page.getByRole("button", { name: "Close workspace dialog" }).focus();
    await waitFor(() => expect(page.queryByRole("tooltip")).not.toBeInTheDocument());
    await user.hover(trigger);
    await waitFor(() => expect(page.getByRole("tooltip")).toBeVisible());
    await user.hover(page.getByRole("heading", { name: "Create workspace" }));
    await waitFor(() => expect(page.queryByRole("tooltip")).not.toBeInTheDocument());
    await user.tab();
    await waitFor(() => {
      expect(page.getByRole("tooltip")).toBeVisible();
      expect(trigger).toHaveFocus();
    });
    page.getByRole("button", { name: "Close workspace dialog" }).focus();
    await waitFor(() => expect(page.queryByRole("tooltip")).not.toBeInTheDocument());
    await expect(page.getByRole("dialog", { name: "Create workspace" })).toBeVisible();
  },
};
