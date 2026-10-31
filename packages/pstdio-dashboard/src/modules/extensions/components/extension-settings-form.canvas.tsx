import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import type { ExecuteOptionCommand } from "@pstdio/workbench/react";
import { ExtensionSettingsForm } from "./extension-settings-form";

// Mirrors the Planner's settings: two toggles, a number, and a branch dropdown whose
// choices come from a command.
const settings: ExtensionSettingValueRecord[] = [
  {
    key: "implementation.adversarialReview",
    extensionId: "pstdio.pstdio-planner",
    type: "boolean",
    scope: "project",
    default: true,
    title: "Adversarial review",
    description: "Run an adversarial review before finishing ticket implementation.",
    value: true,
    source: "default",
  },
  {
    key: "automation.maxInProgress",
    extensionId: "pstdio.pstdio-planner",
    type: "number",
    scope: "project",
    default: 2,
    title: "Maximum in-progress tickets",
    value: 2,
    source: "default",
  },
  {
    key: "implementation.defaultTargetBranch",
    extensionId: "pstdio.pstdio-planner",
    type: "string",
    scope: "project",
    default: "",
    title: "Default target branch",
    description: "Remote branch that new work targets. Clear it to use the repository default branch.",
    options: {
      commandId: "pstdio.pstdio-planner.command.implementation-targets",
      valueField: "branch",
      labelField: "branch",
    },
    value: "origin/main",
    source: "stored",
  },
];
const listBranches: ExecuteOptionCommand = async () => [
  { branch: "origin/main" },
  { branch: "origin/release/next" },
  { branch: "origin/hotfix" },
];
const meta: CanvasMeta<typeof ExtensionSettingsForm> = {
  title: "ProjectSettings/ExtensionSettingsForm",
  component: ExtensionSettingsForm,
  decorators: [
    (Story) => (
      <Box maxW="xl" p="lg">
        <Story />
      </Box>
    ),
  ],
  args: {
    settings,
    executeOptionCommand: listBranches,
    onChangeSetting: () => {},
  },
};
export default meta;
type Story = CanvasFrame<typeof ExtensionSettingsForm>;
export const Loaded: Story = {
  id: "projectsettings-extensionsettingsform--loaded",
};
export const LoadingOptions: Story = {
  id: "projectsettings-extensionsettingsform--loading-options",
  args: { executeOptionCommand: () => new Promise(() => {}) },
};
export const OptionsFailed: Story = {
  id: "projectsettings-extensionsettingsform--options-failed",
  args: {
    executeOptionCommand: async () => {
      throw new Error("Could not list remote branches.");
    },
  },
};
// The saved branch was deleted on the remote. It stays selected until someone picks another.
export const SavedValueNotListed: Story = {
  id: "projectsettings-extensionsettingsform--saved-value-not-listed",
  args: {
    settings: settings.map((setting) =>
      setting.key === "implementation.defaultTargetBranch" ? { ...setting, value: "origin/release/old" } : setting,
    ),
  },
};
export const NoOptions: Story = {
  id: "projectsettings-extensionsettingsform--no-options",
  args: { executeOptionCommand: async () => [] },
};
