import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProjectSetupStatus } from "./project-setup-status";

const meta = {
  title: "Projects/Project setup status",
  component: ProjectSetupStatus,
  args: {
    error:
      "default extensions: Failed to clone https://github.com/pufflyai/prompt-studio.git at pstdio@0.40.0: spawn git ENOENT",
    onRetry: () => {},
  },
} satisfies Meta<typeof ProjectSetupStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

/** First run without Git or a network: the default extensions, including every agent harness, did not install. */
export const MissingGit: Story = {};
export const Retrying: Story = { args: { retrying: true } };
export const FolderNotWritable: Story = {
  args: { error: "EACCES: permission denied, mkdir '/Users/alex/tools/.pstdio'" },
};
export const ProviderPending: Story = {
  args: { error: "The workspace provider has not finished setup. Retry to check its progress." },
};
