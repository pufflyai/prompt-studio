import { defineExtension, defineKeybinding, defineSkill, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { createMachineHarness } from "./src/agent";
import { catalogView } from "./src/catalog-view";
import { commands } from "./src/commands";
import { deployedConnection, deployedSettings } from "./src/deployed-controller";
import { deployedTemplateChoices, launchDeployedWorkspace } from "./src/deployed-launch";
import {
  deployedMachineLogs,
  deployedMachinePage,
  deployedTestOutputView,
  deployedWorkspaceLogsView,
  openDeployedMachine,
  stopDeployedWorkspace,
  stopDeployedWorkspaceWorker,
} from "./src/deployed-machine";
import { openDeployedPreview } from "./src/deployed-preview";
import { deployedSelectionCommands } from "./src/deployed-selection";
import {
  deployedInstancesView,
  deployedMachinesView,
  deployedTemplatesView,
  openDeployed,
  readDeployed,
} from "./src/deployed-workbench";
import { launchInstance } from "./src/instance-commands";
import { launchMachine } from "./src/machine-commands";
import { relaunchMachine, resumeMachine } from "./src/machine-lifecycle";
import { machineLifecycleActions } from "./src/machine-lifecycle-actions";
import { watchMachine } from "./src/machine-watch";
import { createMachineProvider } from "./src/machines";
import { instancesView, machinesView, templatesView } from "./src/native-tables";
import { deployedMachineKind, instanceKind, machineKind, templateKind } from "./src/resources";
import { selectionCommands } from "./src/selection-commands";
import { tableCommands } from "./src/table-commands";
import { deleteTemplateRow, openCatalog, saveTemplate, viewTemplateRow } from "./src/template-commands";
import { templateFileView, templatePage } from "./src/template-view";
import { catalogPage, deployedPage, instancePage, instancesPage, navigation } from "./src/workbench";
import { workspaceHistoryCommands } from "./src/workspace-history-view";
import { monitoringCommands } from "./src/workspace-monitoring-commands";
import {
  workspaceMonitoringDetailPage,
  workspaceMonitoringDetailView,
  workspaceMonitoringView,
} from "./src/workspace-monitoring-view";

export default defineExtension({
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  skills: [
    defineSkill({
      id: "run-cloud-tests",
      title: l10n("cloud-workspaces.tests.title", "Run cloud tests"),
      description: l10n(
        "cloud-workspaces.tests.description",
        "Run branch tests on the deployed PocketCoder controller and collect logs.",
      ),
      source: packageAsset("./skills/run-cloud-tests", import.meta.url),
    }),
    defineSkill({
      id: "launch-cloud-demo",
      title: l10n("cloud-workspaces.demo.title", "Launch a cloud demo"),
      description: l10n(
        "cloud-workspaces.demo.description",
        "Launch Prompt Studio from a branch and open its expiring dashboard URL.",
      ),
      source: packageAsset("./skills/launch-cloud-demo", import.meta.url),
    }),
  ],
  settings: { properties: deployedSettings },
  connections: [deployedConnection],
  commands: [
    ...commands,
    openDeployed,
    readDeployed,
    ...Object.values(workspaceHistoryCommands),
    ...Object.values(monitoringCommands),
    openDeployedMachine,
    openDeployedPreview,
    ...deployedSelectionCommands,
    deployedTemplateChoices,
    launchDeployedWorkspace,
    stopDeployedWorkspace,
    stopDeployedWorkspaceWorker,
    deployedMachineLogs,
    ...tableCommands,
    ...Object.values(selectionCommands),
    deleteTemplateRow,
    viewTemplateRow,
    openCatalog,
    relaunchMachine,
    resumeMachine,
    ...Object.values(machineLifecycleActions),
    watchMachine,
  ],
  workspaceTypes: [createMachineProvider()],
  harnesses: [createMachineHarness()],
  resourceKinds: [instanceKind, machineKind, templateKind, deployedMachineKind],
  views: [
    instancesView,
    templatesView,
    machinesView,
    catalogView,
    templateFileView,
    deployedInstancesView,
    deployedMachinesView,
    deployedTemplatesView,
    deployedTestOutputView,
    deployedWorkspaceLogsView,
    workspaceMonitoringView,
    workspaceMonitoringDetailView,
  ],
  pages: [
    instancesPage,
    instancePage,
    deployedPage,
    deployedMachinePage,
    workspaceMonitoringDetailPage,
    catalogPage,
    templatePage,
  ],
  navigationItems: [navigation],
  keybindings: [
    defineKeybinding({ id: "go-cloud-workspaces", layer: "go", key: "C", sticky: true, action: navigation.action }),
    defineKeybinding({
      id: "create-instance",
      layer: "create",
      key: instanceKind.ref.id[0]!.toUpperCase(),
      action: { kind: "command", target: { command: launchInstance.ref } },
    }),
    defineKeybinding({
      id: "create-machine",
      layer: "create",
      key: machineKind.ref.id[0]!.toUpperCase(),
      action: { kind: "command", target: { command: launchMachine.ref } },
    }),
    defineKeybinding({
      id: "create-template",
      layer: "create",
      key: templateKind.ref.id[0]!.toUpperCase(),
      action: { kind: "command", target: { command: saveTemplate.ref } },
    }),
    defineKeybinding({
      id: "create-deployed-machine",
      layer: "create",
      key: deployedMachineKind.ref.id[0]!.toUpperCase(),
      action: { kind: "command", target: { command: launchDeployedWorkspace.ref } },
    }),
  ],
});
