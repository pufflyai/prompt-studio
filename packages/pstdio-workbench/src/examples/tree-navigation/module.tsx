import { Button, Heading, Stack, Text } from "@chakra-ui/react";
import type { ResourceRef, WorkbenchModuleContribution, WorkbenchWidgetRenderInput } from "../../core";
import { createWorkbenchCore, createWorkbenchSelectionResourceMetadata } from "../../core";
import { createWorkbenchSettingsModule, settingsPanelResource } from "../../react";

const NAV_TREE_ID = "tree-navigation.nav";
const TICKETS_WIDGET_ID = "tree-navigation.tickets";
const WORKSPACES_WIDGET_ID = "tree-navigation.workspaces";
const TICKET_WIDGET_ID = "tree-navigation.ticket";
const SETTINGS_SECTION_ID = "tree-navigation";

const resources = {
  tickets: {
    kind: "tree-navigation.view",
    uri: "tree-navigation://view/tickets",
    id: "tickets",
    label: "Tickets",
    icon: "SquareKanban",
  },
  workspaces: {
    kind: "tree-navigation.view",
    uri: "tree-navigation://view/workspaces",
    id: "workspaces",
    label: "Workspaces",
    icon: "PanelsTopLeft",
  },
  ticket: {
    kind: "tree-navigation.ticket",
    uri: "tree-navigation://ticket/PS-1",
    id: "PS-1",
    label: "PS-1 Tree navigation",
    icon: "Ticket",
    metadata: createWorkbenchSelectionResourceMetadata({
      uri: "tree-navigation://view/tickets",
    }),
  },
} satisfies Record<string, ResourceRef>;

const settingsResource = settingsPanelResource({ id: SETTINGS_SECTION_ID, title: "Settings", icon: "Settings" });

const openResource = (input: WorkbenchWidgetRenderInput, resource: ResourceRef) => {
  void input.workbench.resources.openResource(resource, { replaceActive: true });
};

const TicketsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Stack h="full" minH="0" p="lg" gap="md">
      <Heading size="md">Tickets</Heading>
      <Text color="fg.muted">Open the ticket, then navigate away through the tree.</Text>
      <Button alignSelf="flex-start" onClick={() => openResource(input, resources.ticket)}>
        Open ticket
      </Button>
    </Stack>
  );
};

const WorkspacesWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Stack h="full" minH="0" p="lg" gap="md">
      <Heading size="md">Workspaces</Heading>
      <Text color="fg.muted">Returning to the ticket should select Tickets, not Workspaces.</Text>
      <Button alignSelf="flex-start" onClick={() => openResource(input, resources.ticket)}>
        Return to ticket
      </Button>
    </Stack>
  );
};

const TicketWidget = () => (
  <Stack h="full" minH="0" p="lg" gap="md">
    <Heading size="md">PS-1 Tree navigation</Heading>
    <Text color="fg.muted">The active detail resource selects its Tickets parent in the navigation tree.</Text>
  </Stack>
);

export const createTreeNavigationWorkbench = () => {
  const workbench = createWorkbenchCore();

  workbench.registerModule({
    id: "tree-navigation",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "tree-navigation.view", label: "Tree navigation view" });
      ctx.resources.registerKind({ kind: "tree-navigation.ticket", label: "Tree navigation ticket" });

      ctx.settings.registerSection({ id: SETTINGS_SECTION_ID, title: "Workbench", scope: "global" });
      ctx.settings.registerPanel({
        kind: "custom",
        id: SETTINGS_SECTION_ID,
        title: "Settings",
        section: SETTINGS_SECTION_ID,
        scope: "global",
        icon: "Settings",
        render: () => (
          <Stack p="lg">
            <Heading size="md">Settings</Heading>
            <Text color="fg.muted">Closing this overlay should restore the Tickets selection.</Text>
          </Stack>
        ),
      });
      const settingsSurface = createWorkbenchSettingsModule({ title: "Settings" }).activate(ctx);

      ctx.renderers.registerTreeRenderer({
        id: NAV_TREE_ID,
        title: "Tree navigation",
        getBody: () => [
          {
            id: "navigation",
            nodes: [
              {
                id: resources.tickets.uri,
                label: "Tickets",
                icon: resources.tickets.icon,
                resource: resources.tickets,
              },
              {
                id: resources.workspaces.uri,
                label: "Workspaces",
                icon: resources.workspaces.icon,
                resource: resources.workspaces,
              },
            ],
          },
        ],
        getFooter: () => [
          { id: settingsResource.uri, label: "Settings", icon: settingsResource.icon, resource: settingsResource },
        ],
        getChildren: () => [],
      });
      ctx.layout.registerWidget({
        id: NAV_TREE_ID,
        title: "Tree navigation",
        region: "sidebar",
        rendererId: NAV_TREE_ID,
        regionSize: { defaultPx: 240, minPx: 200, maxPx: 320 },
      });
      ctx.layout.registerWidget({
        id: TICKETS_WIDGET_ID,
        title: "Tickets",
        region: "main",
        rendererId: TICKETS_WIDGET_ID,
      });
      ctx.renderers.registerRenderer({ id: TICKETS_WIDGET_ID, render: (input) => <TicketsWidget input={input} /> });
      ctx.layout.registerWidget({
        id: WORKSPACES_WIDGET_ID,
        title: "Workspaces",
        region: "main",
        rendererId: WORKSPACES_WIDGET_ID,
      });
      ctx.renderers.registerRenderer({
        id: WORKSPACES_WIDGET_ID,
        render: (input) => <WorkspacesWidget input={input} />,
      });
      ctx.layout.registerWidget({
        id: TICKET_WIDGET_ID,
        title: "Ticket",
        region: "main",
        rendererId: TICKET_WIDGET_ID,
      });
      ctx.renderers.registerRenderer({ id: TICKET_WIDGET_ID, render: () => <TicketWidget /> });

      ctx.resources.registerOpener({
        id: "tree-navigation.view-opener",
        canOpen: (resource) => resource.kind === "tree-navigation.view",
        open: (resource, input) =>
          ctx.layout.openWidget(resource.id === "workspaces" ? WORKSPACES_WIDGET_ID : TICKETS_WIDGET_ID, {
            resource,
            replaceActive: input.replaceActive,
            title: resource.label,
          }),
      });
      ctx.resources.registerOpener({
        id: "tree-navigation.ticket-opener",
        canOpen: (resource) => resource.kind === "tree-navigation.ticket",
        open: (resource, input) =>
          ctx.layout.openWidget(TICKET_WIDGET_ID, {
            resource,
            replaceActive: input.replaceActive,
            title: resource.label,
          }),
      });

      ctx.layout.openWidget(NAV_TREE_ID, { pinned: true });
      void ctx.resources.openResource(resources.tickets);

      return settingsSurface;
    },
  } satisfies WorkbenchModuleContribution);

  return workbench;
};
