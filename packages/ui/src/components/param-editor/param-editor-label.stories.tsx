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

export const WithInformation: Story = {};
export const Compact: Story = { args: { compact: true } };
export const WithoutInformation: Story = { args: { description: undefined } };
export const InformationInDialog: Story = {
  decorators: [
    (Story) => (
      <Dialog.Root defaultOpen size="sm" scrollBehavior="inside">
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
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = page.getByRole("button", { name: "About Workspace type" });
    await waitFor(() => expect(page.getByRole("dialog", { name: "Create workspace" })).toHaveStyle({ opacity: "1" }));
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const information = page.getByRole("dialog", { name: "About Workspace type" });
    await waitFor(() => {
      expect(information).toHaveFocus();
      expect(information).toHaveStyle({ opacity: "1" });
    });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(page.getByRole("dialog", { name: "Create workspace" })).toBeVisible();
  },
};
