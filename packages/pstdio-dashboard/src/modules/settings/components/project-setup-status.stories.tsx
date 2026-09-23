import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProjectSetupStatus } from "./project-setup-status";

const meta = {
  title: "Settings/Project setup",
  component: ProjectSetupStatus,
  args: { error: "A configured extension could not be loaded.", onRetry: () => {} },
} satisfies Meta<typeof ProjectSetupStatus>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SetupFailed: Story = {};
export const Retrying: Story = { args: { retrying: true } };

export const ProviderPending: Story = {
  args: { error: "The workspace provider has not finished setup. Retry to check its progress." },
};
