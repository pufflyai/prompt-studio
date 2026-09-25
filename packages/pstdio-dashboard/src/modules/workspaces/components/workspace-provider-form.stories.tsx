import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkspaceProviderForm } from "./workspace-provider-form";

const git = {
  id: "pstdio.worktree",
  label: "Git worktree",
  description: "Git review and merge cover the entire repository, including paths outside the project folder.",
  params: { base: { type: "text" as const, label: "Base revision", defaultValue: "HEAD", required: true } },
};
const remote = {
  id: "cloud.environment",
  label: "Remote environment",
  description: "The provider supplies its files. Local files are not uploaded or synchronized.",
  params: {
    image: { type: "text" as const, label: "Environment image", required: true },
    source: { type: "text" as const, label: "Source URL" },
  },
};
const meta = {
  title: "Workspaces/Provider selection",
  component: WorkspaceProviderForm,
  args: { providers: [], onSubmit: async () => {} },
} satisfies Meta<typeof WorkspaceProviderForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NoProviders: Story = {};
export const GitAndRemote: Story = { args: { providers: [git, remote] } };
export const RemoteParameters: Story = { args: { providers: [remote] } };
export const TranslationTokens: Story = {
  args: {
    providers: [
      {
        id: "cloud.localized",
        label: { $l10n: "workspace.cloud" },
        description: { $l10n: "workspace.description" },
        params: {
          region: {
            type: "select",
            label: { $l10n: "workspace.region" },
            description: { $l10n: "workspace.regionDescription" },
            options: [{ value: "eu", label: { $l10n: "workspace.europe" } }],
          },
        },
      },
    ],
  },
};
export const NoLocation: Story = { args: { providers: [] } };
export const Provisioning: Story = { args: { providers: [remote], busy: true } };
export const ProviderFailure: Story = {
  args: {
    providers: [remote],
    onSubmit: async () => {
      throw new Error("The environment could not be created. Try again.");
    },
  },
};
