import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { type ComponentProps, useState } from "react";
import type { Command, RegisteredCommand } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { CommandParamsDialog } from "./command-params-dialog";

const registerCommand = (command: Command) =>
  ({
    command,
    handler: { execute: () => undefined },
    ownerId: "preview",
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
  id: "preview.every-param",
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
  id: "preview.files-param",
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
const CommandParameterExample = (props: ComponentProps<typeof CommandParamsDialog>) => {
  const { onClose, request } = props;
  const [open, setOpen] = useState(false);
  return (
    <Stack align="flex-start" gap="sm" p="lg">
      <Stack gap="xs">
        <Text textStyle="heading/S/semibold">{request?.label}</Text>
        <Text color="fg.muted">The workbench builds the form from the command's parameter schema.</Text>
      </Stack>
      <Button size="sm" onClick={() => setOpen(true)}>
        Open parameter form
      </Button>
      <CommandParamsDialog
        {...props}
        request={open ? request : null}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
    </Stack>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Command parameters",
  component: CommandParamsDialog,
  description:
    "Command parameter schemas in @pstdio/sdk/extensions describe input fields. The host renders the form, validates it, and passes normalized values to the command.",
  args: {
    onClose: () => {},
    onRun: async () => {},
  },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box minH="180px">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof CommandParamsDialog>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const NumberParameter: Story = {
  id: "pstdio-workbench-guides-command-parameters--number-parameter",
  render: (args) => <CommandParameterExample {...args} />,
  args: {
    request: {
      label: "Bump lab counter",
      record: bumpCounterCommand,
    },
  },
};
export const RefineTicket: Story = {
  id: "pstdio-workbench-guides-command-parameters--refine-ticket",
  render: (args) => <CommandParameterExample {...args} />,
  args: {
    request: {
      label: "Refine ticket",
      record: refineTicketCommand,
    },
  },
};
export const EveryControl: Story = {
  id: "pstdio-workbench-guides-command-parameters--every-control",
  render: (args) => <CommandParameterExample {...args} />,
  args: {
    request: {
      label: "Run with every param type",
      record: everyControlCommand,
    },
  },
};
export const FilesParameter: Story = {
  id: "pstdio-workbench-guides-command-parameters--files-parameter",
  render: (args) => <CommandParameterExample {...args} />,
  args: {
    request: {
      label: "Import data files",
      record: filesCommand,
    },
  },
};
const dynamicRequest = {
  label: "Run experiment",
  record: {
    command: {
      id: "run",
      label: "Run experiment",
      params: {
        region: {
          type: "select",
          label: "Region",
          defaultValue: "eu",
          options: [
            { value: "eu", label: "Europe" },
            { value: "us", label: "United States" },
          ],
        },
        locale: {
          type: "select",
          label: "Locale",
          required: true,
          options: {
            commandId: "locales",
            valueField: "id",
            labelField: "name",
            params: { region: { kind: "param-value", key: "region" } },
          },
        },
      },
    },
  },
};
export const DependentOptions: Story = {
  id: "pstdio-workbench-guides-command-parameters--dependent-options",
  render: (args) => <CommandParameterExample {...args} />,
  args: {
    request: dynamicRequest,
    executeOptionCommand: async (_id, args) => [
      { id: args.region === "eu" ? "de" : "en", name: args.region === "eu" ? "German" : "English" },
    ],
  },
};
export const LoadingOptions: Story = {
  id: "pstdio-workbench-guides-command-parameters--loading-options",
  ...DependentOptions,
  args: { request: dynamicRequest, executeOptionCommand: () => new Promise(() => {}) },
};
export const FailedOptions: Story = {
  id: "pstdio-workbench-guides-command-parameters--failed-options",
  ...DependentOptions,
  args: {
    request: dynamicRequest,
    executeOptionCommand: async () => {
      throw new Error("Could not load locales.");
    },
  },
};
export const EmptyOptions: Story = {
  id: "pstdio-workbench-guides-command-parameters--empty-options",
  ...DependentOptions,
  args: { request: dynamicRequest, executeOptionCommand: async () => [] },
};
// The planner's "Run attempt": when the ticket cannot start, Run keeps the dialog open
// and shows the command's reason above the actions.
const runAttemptCommand = registerCommand({
  id: "pstdio-planner.run-attempt",
  label: "Run attempt",
  params: {
    model: {
      type: "select",
      label: "Model",
      defaultValue: "opus",
      options: [{ label: "Claude Opus", value: "opus", icon: "Cpu" }],
    },
    mode: {
      type: "select",
      label: "Mode",
      defaultValue: "worktree",
      options: [{ label: "Worktree", value: "worktree", icon: "GitFork" }],
    },
  },
});
export const RunFailed: Story = {
  id: "pstdio-workbench-guides-command-parameters--run-failed",
  render: (args) => <CommandParameterExample {...args} />,
  args: {
    request: { label: "Run attempt", record: runAttemptCommand },
    onRun: async () => {
      throw new Error("PS-458 can't start: it waits on PS-457, which is not done and has no attempt to build on.");
    },
  },
};
