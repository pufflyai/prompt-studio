import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ExtensionsPanelView } from "./extensions-panel";

const meta: Meta<typeof ExtensionsPanelView> = {
  title: "ProjectSettings/ExtensionsPanel",
  component: ExtensionsPanelView,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="720px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ExtensionsPanelView>;

export const InstalledWithDiagnostics: Story = {
  args: {
    extensions: [
      {
        id: "pstdio-core-skills",
        namespace: "core.skills",
        displayName: "Core Skills",
        version: "1.4.0",
        description: "Adds the standard project implementation and ticket workflow skills.",
        sourcePath: "/workspace/.pstdio/extensions/core-skills",
      },
      {
        id: "release-catalog",
        namespace: "acme.release",
        displayName: "Release Catalog",
        description: "Publishes release notes, changelogs, and deployment checklists.",
        sourcePath: "/workspace/extensions/release-catalog",
      },
    ],
    diagnostics: [
      {
        code: "extension.command.missing",
        severity: "warning",
        message: "Command release.publish points to a missing script.",
        extensionId: "release-catalog",
        sourcePath: "/workspace/extensions/release-catalog/extension.json",
      },
      {
        code: "extension.view.invalid",
        severity: "error",
        message: "View check-report is missing a webview entry.",
        extensionId: "release-catalog",
      },
    ],
  },
};

export const EmptyWithDiagnostics: Story = {
  args: {
    extensions: [],
    diagnostics: [
      {
        code: "extension.root.missing",
        severity: "warning",
        message: "No enabled extension manifests were found for this project.",
      },
    ],
  },
};
