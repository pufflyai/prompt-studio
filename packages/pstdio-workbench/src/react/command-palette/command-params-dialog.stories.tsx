import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Command, RegisteredCommand } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { CommandParamsDialog } from "./command-params-dialog";

const registerCommand = (command: Command) =>
  ({
    command,
    handler: { execute: () => undefined },
    ownerId: "storybook",
    priority: 0,
    source: "module",
  }) satisfies RegisteredCommand;

const bumpCounterCommand = registerCommand({
  id: "extension-lab.counter.bump",
  label: "Bump lab counter",
  params: {
    amount: {
      type: "number",
      label: "Amount",
      defaultValue: 1,
    },
  },
});

// The planner's "Refine ticket" shape: a template picker plus free-form context,
// the two fields that used to be hand-rolled beside the editor-rendered ones.
const refineTicketCommand = registerCommand({
  id: "pstdio-planner.refine-ticket",
  label: "Refine ticket",
  description: "Research the ticket and expand it with implementation detail.",
  params: {
    template: {
      type: "template",
      label: "Template",
      required: false,
      options: [
        { label: "Proposal", value: "proposal", icon: "FileText" },
        { label: "Bug report", value: "bug-report", icon: "FileText" },
      ],
    },
    context: { type: "longtext", label: "Additional context", required: false },
  },
});

const everyControlCommand = registerCommand({
  id: "storybook.every-param",
  label: "Run with every param type",
  params: {
    title: { type: "text", label: "Title", required: true },
    mode: {
      type: "select",
      label: "Mode",
      defaultValue: "worktree",
      options: [
        { label: "Worktree", value: "worktree", icon: "GitFork" },
        { label: "Current branch", value: "current_branch", icon: "GitBranch" },
      ],
    },
    labels: {
      type: "multi-select",
      label: "Labels",
      options: [
        { label: "Bug", value: "bug" },
        { label: "Feature", value: "feature" },
      ],
    },
    attempts: { type: "number", label: "Attempts", defaultValue: 2 },
    draft: { type: "boolean", label: "Open as draft" },
    notes: { type: "longtext", label: "Notes" },
  },
});

const filesCommand = registerCommand({
  id: "storybook.files-param",
  label: "Import data files",
  params: {
    files: {
      type: "files",
      label: "Data files",
      description: "Choose one or more CSV files to import.",
      required: true,
      multiple: true,
      accept: ".csv",
    },
  },
});

const meta = {
  title: "pstdio-workbench/CommandParamsDialog",
  component: CommandParamsDialog,
  parameters: { layout: "fullscreen" },
  args: {
    onClose: () => {},
    onRun: async () => {},
  },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box minH="100dvh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof CommandParamsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NumberParameter: Story = {
  args: {
    request: {
      label: "Bump lab counter",
      record: bumpCounterCommand,
    },
  },
};

export const RefineTicket: Story = {
  args: {
    request: {
      label: "Refine ticket",
      record: refineTicketCommand,
    },
  },
};

export const EveryControl: Story = {
  args: {
    request: {
      label: "Run with every param type",
      record: everyControlCommand,
    },
  },
};

export const FilesParameter: Story = {
  args: {
    request: {
      label: "Import data files",
      record: filesCommand,
    },
  },
};
