import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExtensionReplacementConfirmation } from "./extension-replacement-confirmation";

const meta = {
  title: "Settings/Extension Replacement Confirmation",
  component: ExtensionReplacementConfirmation,
} satisfies Meta<typeof ExtensionReplacementConfirmation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ExistingExtension: Story = {
  args: { replacement: { name: "My Tool", retry: async () => {} }, onClose: () => {} },
};
