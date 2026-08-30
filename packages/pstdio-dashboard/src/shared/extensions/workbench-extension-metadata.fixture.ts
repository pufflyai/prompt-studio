import type { WorkbenchExtensionMetadata as DashboardExtensionMetadata } from "@pstdio/sdk/api";
import { metadata } from "@/modules/extensions/module-test-fixtures";

const extensionId = "pstdio.extension-lab";
const pageViewId = `${extensionId}.view.lab-page`;

export const extensionLabMetadata = {
  ...metadata,
  commands: [
    ...metadata.commands,
    { id: `${extensionId}.command.demo.workspace-only`, extensionId, title: "Workspace-only lab action" },
  ],
  menuContributions: [
    {
      id: `${extensionId}.command.say-hello.header`,
      extensionId,
      commandId: `${extensionId}.command.say-hello`,
      slotId: "project.headerPrimary",
      label: "Lab: Say hello",
      icon: "flask-conical",
      when: { viewId: pageViewId },
    },
    {
      id: `${extensionId}.command.counter.bump.header`,
      extensionId,
      commandId: `${extensionId}.command.counter.bump`,
      slotId: "project.headerOverflow",
      label: "Bump lab counter",
      icon: "plus",
      when: { viewId: pageViewId },
    },
    {
      id: `${extensionId}.command.say-hello.palette`,
      extensionId,
      commandId: `${extensionId}.command.say-hello`,
      slotId: "project.commandPanel",
      label: "Say hello",
      group: "Lab",
    },
    {
      id: `${extensionId}.command.demo.workspace-only.header`,
      extensionId,
      commandId: `${extensionId}.command.demo.workspace-only`,
      slotId: "workspace.headerPrimary",
      label: "Workspace-only lab action",
    },
  ],
} satisfies DashboardExtensionMetadata;
