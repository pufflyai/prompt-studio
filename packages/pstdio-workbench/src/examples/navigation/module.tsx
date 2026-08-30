import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import {
  headerTrailingMenuPath,
  type ResourceRef,
  type WorkbenchCore,
  type WorkbenchModuleContribution,
} from "../../core";

const PAGE_ID = "navigation.example.page";
const HOME_RENDERER_ID = "navigation.example.home-renderer";
const HOME_WIDGET_ID = "navigation.example.home";
const TICKET_RENDERER_ID = "navigation.example.ticket-renderer";
const TICKET_WIDGET_ID = "navigation.example.ticket";
const TREE_RENDERER_ID = "navigation.example.tree-renderer";
const TREE_WIDGET_ID = "navigation.example.workspace-tree";
const TREE_SLOT_ID = "tree";
const FOCUS_MAIN_COMMAND_ID = "navigation.example.focus-main";

const TICKET_KIND = "navigation.example.ticket";

const ticketResource = (id: string): ResourceRef => ({
  kind: TICKET_KIND,
  uri: `${TICKET_KIND}:${id}`,
  id,
  label: `Ticket ${id}`,
  icon: "component",
});

const navigate = (workbench: WorkbenchCore, location: string) =>
  workbench.navigation.navigate(location).catch((error) => {
    workbench.notifications.show({
      level: "error",
      title: "Navigation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  });

const TicketWidget = (props: { uri: string; workbench: WorkbenchCore }) => {
  const { uri, workbench } = props;
  return (
    <Stack p="lg" gap="sm">
      <Text textStyle="title/S/semibold">Ticket viewer</Text>
      <Text textStyle="paragraph/M/regular">
        The page binds the ticket kind to this panel, so page targets carrying a ticket resource land here.
      </Text>
      <Code colorPalette="gray">{uri}</Code>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => navigate(workbench, "nav://resource?id=PS-100")}>
          Open PS-100
        </Button>
        <Button size="sm" onClick={() => navigate(workbench, "nav://resource?id=PS-200")}>
          Open PS-200
        </Button>
      </HStack>
    </Stack>
  );
};

const TreeWidget = () => (
  <Stack p="md" gap="xs">
    <Text textStyle="label/S/semibold">Workspace tree</Text>
    <Text textStyle="paragraph/S/regular">A static page slot, revealed via a page target with a slot id.</Text>
  </Stack>
);

const HomeWidget = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const fire = (location: string) => navigate(workbench, location);

  return (
    <Stack p="lg" gap="md">
      <Text textStyle="title/S/semibold">Navigation dispatcher demo</Text>
      <Text textStyle="paragraph/M/regular">
        Each button below feeds <Code colorPalette="gray">workbench.navigation.navigate(...)</Code> a deep link and the
        registered parser resolves it into a <Code colorPalette="gray">NavigationTarget</Code>. Targets are pages,
        commands, or hrefs; a resource is never a destination — it rides along as an argument on a page target.
      </Text>
      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          page + resource
        </Text>
        <HStack gap="sm" wrap="wrap">
          <Button size="sm" onClick={() => fire("nav://resource?id=PS-100")}>
            Open ticket PS-100
          </Button>
          <Button size="sm" onClick={() => fire("nav://resource?id=PS-200")}>
            Open ticket PS-200
          </Button>
        </HStack>
      </Box>
      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          page + slot
        </Text>
        <Button size="sm" onClick={() => fire("nav://view?id=workspace-tree")}>
          Reveal workspace tree
        </Button>
      </Box>
      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          command
        </Text>
        <Button size="sm" onClick={() => fire(`nav://command?id=${FOCUS_MAIN_COMMAND_ID}`)}>
          Focus main region (via command target)
        </Button>
      </Box>
      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          compound (page + resource, then page + slot)
        </Text>
        <Button size="sm" onClick={() => fire("nav://open?resource=ticket:PS-300&view=workspace-tree")}>
          Open PS-300 and reveal tree
        </Button>
      </Box>
    </Stack>
  );
};

export const createNavigationExampleModule = (): WorkbenchModuleContribution => ({
  id: "navigation.example",
  activate(ctx) {
    ctx.commands.registerCommand(
      {
        id: FOCUS_MAIN_COMMAND_ID,
        label: "Focus main region",
        category: "Navigation",
        icon: "Crosshair",
      },
      { execute: () => ctx.focus.setActiveRegion("main") },
    );

    ctx.resources.registerKind({
      kind: TICKET_KIND,
      label: "Ticket",
      icon: "component",
    });

    ctx.renderers.registerRenderer({
      id: HOME_RENDERER_ID,
      render: ({ workbench }) => <HomeWidget workbench={workbench} />,
    });

    ctx.renderers.registerRenderer({
      id: TICKET_RENDERER_ID,
      render: ({ instance, workbench }) => (
        <TicketWidget workbench={workbench} uri={instance.resource?.uri ?? instance.instanceId} />
      ),
    });

    ctx.renderers.registerRenderer({
      id: TREE_RENDERER_ID,
      render: () => <TreeWidget />,
    });

    ctx.layout.registerPanel({
      id: HOME_WIDGET_ID,
      title: "Navigation demo",
      region: "main",
      singleton: true,
      rendererId: HOME_RENDERER_ID,
    });

    ctx.layout.registerPanel({
      id: TICKET_WIDGET_ID,
      title: "Ticket",
      region: "main",
      singleton: false,
      rendererId: TICKET_RENDERER_ID,
      resourceKinds: [TICKET_KIND],
    });

    ctx.layout.registerPanel({
      id: TREE_WIDGET_ID,
      title: "Workspace tree",
      region: "sidenav",
      regionSize: { defaultPx: 240, minPx: 200 },
      singleton: true,
      rendererId: TREE_RENDERER_ID,
    });

    // The page is the navigable destination: static slots place the home demo and
    // the tree, the binding routes ticket resources into the bound main slot.
    ctx.pages.registry.registerPage({
      id: PAGE_ID,
      title: "Navigation demo",
      icon: "Route",
      slots: [
        { id: "home", region: "main", panelId: HOME_WIDGET_ID, closable: false, order: 0 },
        { id: "tickets", region: "main", cardinality: "many", order: 1 },
        { id: TREE_SLOT_ID, region: "sidenav", panelId: TREE_WIDGET_ID, order: 0 },
      ],
      bindings: [{ kind: TICKET_KIND, panelId: TICKET_WIDGET_ID, slot: "tickets" }],
    });

    ctx.navigation.registerParser({
      id: "navigation.example.parser",
      canParse: (location) => location.startsWith("nav://"),
      parse: (location) => {
        const url = new URL(location);
        // nav://resource?id=PS-100 opens the page with the ticket as its argument.
        if (url.host === "resource") {
          const id = url.searchParams.get("id") ?? "PS-000";
          return { kind: "page", pageId: PAGE_ID, resource: ticketResource(id) };
        }
        // nav://view?id=workspace-tree reveals the page's static tree slot.
        if (url.host === "view") {
          return { kind: "page", pageId: PAGE_ID, slot: TREE_SLOT_ID };
        }
        if (url.host === "command") {
          const id = url.searchParams.get("id") ?? "";
          return { kind: "command", commandId: id };
        }
        // nav://open?resource=ticket:PS-300&view=... applies both page targets in
        // order; a failure rolls the whole compound back.
        if (url.host === "open") {
          const ticketParam = url.searchParams.get("resource");
          const ticketId = ticketParam?.split(":")[1] ?? "PS-000";
          return {
            kind: "compound",
            targets: [
              { kind: "page", pageId: PAGE_ID, resource: ticketResource(ticketId) },
              { kind: "page", pageId: PAGE_ID, slot: TREE_SLOT_ID },
            ],
          };
        }
        throw new Error(`Unrecognized navigation host: ${url.host}`);
      },
    });

    ctx.layout.registerMenuItem(headerTrailingMenuPath("main"), {
      commandId: FOCUS_MAIN_COMMAND_ID,
      group: "Navigation",
    });

    void ctx.pages.activatePage(PAGE_ID);
  },
});
