import { CloseButton, Dialog } from "@chakra-ui/react";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { WorkspaceProviderForm } from "./workspace-provider-form";

const git = {
  id: "pstdio.worktree",
  label: "Git worktree",
  icon: "git-branch",
  description: "Git review and merge cover the entire repository, including paths outside the project folder.",
  params: {
    base: {
      type: "select" as const,
      label: "Base branch",
      defaultValue: "main",
      required: true,
      options: ["main", "develop", "feature/documents"].map((value) => ({
        label: value,
        value,
        icon: "git-commit-horizontal",
      })),
    },
  },
};
const remote = {
  id: "cloud.environment",
  label: "Remote environment",
  icon: "rocket",
  description: "The provider supplies its files. Local files are not uploaded or synchronized.",
  params: {
    image: { type: "text" as const, label: "Environment image", required: true },
    source: { type: "text" as const, label: "Source URL" },
  },
};
const meta = {
  title: "Workspaces/Provider selection",
  component: WorkspaceProviderForm,
  args: { providers: [git, remote], onSubmit: async () => {}, onCancel: () => {} },
  decorators: [
    (Story) => (
      <Dialog.Root open size="sm" placement="center" scrollBehavior="inside" closeOnInteractOutside={false}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Create workspace</Dialog.Title>
            </Dialog.Header>
            <Story />
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" aria-label="Close Create workspace" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ),
  ],
} satisfies Meta<typeof WorkspaceProviderForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GitAndRemote: Story = {};
export const GitBranches: Story = { args: { providers: [git] } };
export const RemoteParameters: Story = { args: { providers: [remote, git] } };
export const NoProviders: Story = { args: { providers: [] } };
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
    providers: [git, remote],
    onSubmit: async () => {
      throw new Error("The environment could not be created. Try again.");
    },
  },
};

const machine: WorkspaceProviderDescriptor = {
  id: "example.cloud.workspace-type.machine",
  label: "Agent machine",
  params: {
    instance: {
      type: "select",
      label: "Instance",
      required: true,
      options: {
        command: { kind: "command", id: "instances", extensionId: "example.cloud" },
        valueField: "id",
        labelField: "name",
      },
    },
    template: {
      type: "select",
      label: "Template",
      required: true,
      options: {
        command: { kind: "command", id: "templates", extensionId: "example.cloud" },
        valueField: "id",
        labelField: "name",
        params: { instance: { kind: "param-value", key: "instance" } },
      },
    },
    tools: {
      type: "multi-select",
      label: "Tools",
      options: {
        command: { kind: "command", id: "tools", extensionId: "example.cloud" },
        valueField: "id",
        labelField: "name",
      },
    },
  },
};

const machineChoices = async (commandId: string, args: Record<string, unknown>) => {
  if (commandId.endsWith(".instances"))
    return [
      { id: "local", name: "Local controller" },
      { id: "team", name: "Team controller" },
    ];
  if (commandId.endsWith(".tools"))
    return [
      { id: "git", name: "Git" },
      { id: "bun", name: "Bun" },
    ];
  if (!args.instance) return [];
  return [{ id: `${args.instance}-code`, name: `${args.instance} coding agent` }];
};

export const CommandBackedChoices: Story = {
  args: { providers: [machine, git], executeOptionCommand: machineChoices },
};
export const LoadingChoices: Story = {
  args: { providers: [machine], executeOptionCommand: () => new Promise(() => {}) },
};
export const EmptyChoices: Story = {
  args: { providers: [machine], executeOptionCommand: async () => [] },
};
export const FailedChoices: Story = {
  args: {
    providers: [machine],
    executeOptionCommand: async () => {
      throw new Error("Controller unavailable. Try again.");
    },
  },
};
export const RetryChoices: Story = {
  args: {
    providers: [machine],
    executeOptionCommand: (() => {
      const failed = new Set<string>();
      return async (id: string, args: Record<string, unknown>) => {
        if (!failed.has(id)) {
          failed.add(id);
          throw new Error("Controller unavailable. Try again.");
        }
        return machineChoices(id, args);
      };
    })(),
  },
};
