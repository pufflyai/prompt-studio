import { Box } from "@chakra-ui/react";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
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

const coreSkills: ProjectExtensionInstance = {
  id: "instance-core-skills",
  projectId: "demo-project",
  extensionId: "pstdio.core-skills",
  installedExtensionId: "installed-core-skills",
  installName: "pstdio-core-skills",
  name: "pstdio-core-skills",
  displayName: "Core Skills",
  version: "1.4.0",
  description: "Adds the standard project implementation and ticket workflow skills.",
  sourcePath: "/workspace/.pstdio/extensions/core-skills",
  enabled: true,
  config: {},
};

const releaseCatalog: ProjectExtensionInstance = {
  id: "instance-release-catalog",
  projectId: "demo-project",
  extensionId: "acme.release-catalog",
  installedExtensionId: "installed-release-catalog",
  installName: "release-catalog",
  name: "release-catalog",
  displayName: "Release Catalog",
  description: "Publishes release notes, changelogs, and deployment checklists.",
  sourcePath: "/workspace/extensions/release-catalog",
  enabled: false,
  config: {},
};

export const Populated: Story = {
  args: {
    extensions: [coreSkills, releaseCatalog],
    diagnostics: [],
  },
};

export const PopulatedWithDiagnostics: Story = {
  args: {
    extensions: [coreSkills, releaseCatalog],
    diagnostics: [
      {
        code: "extension.command.missing",
        severity: "warning",
        message: "Command release.publish points to a missing script.",
        extensionId: "acme.release-catalog",
        sourcePath: "/workspace/extensions/release-catalog/extension.json",
      },
      {
        code: "extension.view.invalid",
        severity: "error",
        message: "View check-report is missing a webview entry.",
        extensionId: "acme.release-catalog",
      },
    ],
  },
};

export const Mutating: Story = {
  args: {
    extensions: [coreSkills, releaseCatalog],
    diagnostics: [],
    togglingInstanceId: coreSkills.id,
    uninstallingInstanceId: releaseCatalog.id,
  },
};

export const Empty: Story = {
  args: {
    extensions: [],
    diagnostics: [],
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
