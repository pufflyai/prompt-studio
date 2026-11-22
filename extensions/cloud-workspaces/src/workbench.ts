import {
  defineNavigationItem,
  definePage,
  type Localizable,
  l10n,
  type PlacementTabPresentation,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { catalogView } from "./catalog-view";
import { deployedInstancesView, deployedMachinesView, deployedTemplatesView } from "./deployed-workbench";
import { startInstance, stopInstance } from "./instance-commands";
import { removeInstance } from "./instance-removal";
import { instancesFor } from "./instances";
import { labCommands } from "./lab-commands";
import { instancesPageRef } from "./lab-navigation";
import { instancesView, machinesView, templatesView } from "./native-tables";
import { changed, instanceKind } from "./resources";
import { workspaceHistoryView } from "./workspace-history-view";

const instanceTab = (label: Localizable<string>) =>
  ({
    refreshEvents: [changed],
    async query(ctx, { renderer }) {
      const instances = await instancesFor(ctx.projectId).list();
      const current = renderer.resource?.id;
      return {
        label,
        menu: [
          {
            id: "instances",
            label: l10n("cloud-workspaces.pocketcoder-instances", "PocketCoder instances"),
            rows: instances
              .filter((instance) => instance.state === "running" || instance.id === current)
              .sort((a, b) => Number(b.state === "running") - Number(a.state === "running"))
              .map((instance) => ({
                id: instance.id,
                label: instance.state === "running" ? instance.name : `${instance.name} (stopped)`,
                icon: "server",
                selected: instance.id === current,
                action: {
                  kind: "command" as const,
                  target: { command: labCommands["lab.select"].ref, params: { instance: instance.id } },
                },
              })),
          },
          {
            id: "manage",
            rows: [
              {
                id: "browse",
                label: l10n("cloud-workspaces.manage-instances", "Manage instances"),
                icon: "server",
                action: { kind: "page" as const, page: instancesPageRef },
              },
              ...(current
                ? [
                    {
                      id: "start",
                      label: l10n("cloud-workspaces.start-instance", "Start instance"),
                      icon: "play",
                      action: {
                        kind: "command" as const,
                        target: { command: startInstance.ref, params: { instanceId: current } },
                      },
                    },
                    {
                      id: "stop",
                      label: l10n("cloud-workspaces.stop-instance", "Stop instance"),
                      icon: "square",
                      action: {
                        kind: "command" as const,
                        target: { command: stopInstance.ref, params: { instanceId: current } },
                      },
                    },
                    ...(instances.find((instance) => instance.id === current)?.state === "stopped"
                      ? [
                          {
                            id: "remove",
                            label: l10n("cloud-workspaces.remove-instance", "Remove instance"),
                            icon: "trash-2",
                            action: {
                              kind: "command" as const,
                              target: { command: removeInstance.ref, params: { instanceId: current } },
                            },
                          },
                        ]
                      : []),
                  ]
                : []),
            ],
          },
        ],
      };
    },
  }) satisfies PlacementTabPresentation;
export const instancesPage = definePage({
  id: "instances",
  title: l10n("cloud-workspaces.title", "Cloud Workspaces"),
  icon: "server",
  path: "pocketcoder",
  mode: workbenchModes.project,
  main: { kind: "panels", landing: "local" },
  slots: [
    { id: "local", region: "main", order: 0, item: { kind: "view", view: instancesView.ref, presence: "open" } },
    {
      id: "deployed",
      region: "main",
      order: 1,
      item: { kind: "view", view: deployedInstancesView.ref, presence: "open" },
    },
  ],
});
export const deployedPage = definePage({
  id: "deployed",
  title: l10n("cloud-workspaces.deployed-pocketcoder", "Deployed PocketCoder"),
  icon: "cloud",
  path: "pocketcoder-deployed",
  mode: workbenchModes.project,
  parent: instancesPage.ref,
  main: { kind: "panels", landing: "machines" },
  slots: [
    {
      id: "machines",
      region: "main",
      order: 0,
      item: { kind: "view", view: deployedMachinesView.ref, presence: "open" },
    },
    {
      id: "templates",
      region: "main",
      order: 1,
      item: { kind: "view", view: deployedTemplatesView.ref, presence: "open" },
    },
    {
      id: "workspace-history",
      region: "main",
      order: 2,
      item: { kind: "view", view: workspaceHistoryView.ref, presence: "open" },
    },
  ],
});
export const catalogPage = definePage({
  id: "catalog",
  title: l10n("cloud-workspaces.template-catalog", "Template catalog"),
  icon: "package",
  path: "pocketcoder-templates",
  mode: workbenchModes.project,
  parent: instancesPage.ref,
  main: { kind: "view", presentation: "page", view: catalogView.ref, cardinality: "one" },
  slots: [],
});
export const instancePage = definePage({
  id: "instance",
  title: l10n("cloud-workspaces.pocketcoder-instance", "PocketCoder instance"),
  icon: "server",
  path: "pocketcoder-instance",
  mode: workbenchModes.project,
  parent: instancesPage.ref,
  resource: { kinds: [instanceKind.ref] },
  main: { kind: "panels", landing: "machines" },
  slots: [
    {
      id: "templates",
      region: "main",
      order: 0,
      tab: instanceTab(l10n("cloud-workspaces.templates", "Templates")),
      item: { kind: "view", view: templatesView.ref, presence: "open" },
    },
    {
      id: "machines",
      region: "main",
      order: 1,
      tab: instanceTab(l10n("cloud-workspaces.machines", "Machines")),
      item: { kind: "view", view: machinesView.ref, presence: "open" },
    },
  ],
});
export const navigation = defineNavigationItem({
  id: "pocketcoder",
  label: l10n("cloud-workspaces.title", "Cloud Workspaces"),
  icon: "server",
  owner: workbenchModes.project,
  slot: "content",
  action: { kind: "page", page: instancesPage.ref, intent: "restore" },
});
