import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { headerTrailingMenuPath, type WorkbenchCore, type WorkbenchModuleContribution } from "../../core";

const HOME_RENDERER_ID = "navigation.example.home-renderer";
const HOME_WIDGET_ID = "navigation.example.home";
const TICKET_RENDERER_ID = "navigation.example.ticket-renderer";
const TICKET_WIDGET_ID = "navigation.example.ticket";
const TREE_RENDERER_ID = "navigation.example.tree-renderer";
const TREE_WIDGET_ID = "navigation.example.workspace-tree";
const FOCUS_MAIN_COMMAND_ID = "navigation.example.focus-main";

const TICKET_KIND = "navigation.example.ticket";
const AGGREGATE_SCOPE = "project/demo/mode/tickets/aggregate/tickets";

const resourceScope = (uri: string) => `project/demo/mode/tickets/resource/${uri}`;

const switchLayoutScope = (workbench: WorkbenchCore, scope: string) => {
  workbench.panels.setPersistenceScope(scope);
  workbench.layout.setPersistenceScope(scope, {
    carryRegionState: ["sidenav"],
  });
};

const navigateToTicket = (workbench: WorkbenchCore, id: string) =>
  workbench.navigation.navigate(`nav://resource?id=${id}`).catch((error) => {
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
        Navigation selects the resource-owned layout and Panel scope before calling{" "}
        <Code colorPalette="gray">openResource</Code>.
      </Text>
      <Code colorPalette="gray">{uri}</Code>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => navigateToTicket(workbench, "PS-100")}>
          Open PS-100
        </Button>
        <Button size="sm" onClick={() => navigateToTicket(workbench, "PS-200")}>
          Open PS-200
        </Button>
        <Button size="sm" variant="outline" onClick={() => switchLayoutScope(workbench, AGGREGATE_SCOPE)}>
          Return to tickets
        </Button>
      </HStack>
    </Stack>
  );
};

const TreeWidget = () => (
  <Stack p="md" gap="xs">
    <Text textStyle="label/S/semibold">Workspace tree</Text>
    <Text textStyle="paragraph/S/regular">Revealed via openWidget.</Text>
  </Stack>
);

const HomeWidget = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const fire = (location: string) =>
    workbench.navigation.navigate(location).catch((error) => {
      workbench.notifications.show({
        level: "error",
        title: "Navigation failed",
        message: error instanceof Error ? error.message : String(error),
      });
    });

  return (
    <Stack p="lg" gap="md">
      <Text textStyle="title/S/semibold">Navigation dispatcher demo</Text>
      <Text textStyle="paragraph/M/regular">
        Each button below feeds <Code colorPalette="gray">workbench.navigation.navigate(...)</Code> a deep link and the
        widened parser resolves it into a <Code colorPalette="gray">NavigationTarget</Code>. The dispatcher then routes
        to the appropriate opener.
      </Text>
      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          resource
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
          view
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
          compound (resource + view)
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

    ctx.resources.registerOpener({
      id: "navigation.example.ticket-opener",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource) => {
        ctx.panels.setPersistenceScope(resourceScope(resource.uri));
        ctx.layout.setPersistenceScope(resourceScope(resource.uri), {
          carryRegionState: ["sidenav"],
        });
        ctx.layout.openWidget(TICKET_WIDGET_ID, {
          resource,
          title: resource.label ?? resource.uri,
        });
      },
    });

    ctx.renderers.registerRenderer({
      id: HOME_RENDERER_ID,
      render: ({ workbench }) => <HomeWidget workbench={workbench} />,
    });

    ctx.renderers.registerRenderer({
      id: TICKET_RENDERER_ID,
      render: ({ placement, workbench }) => (
        <TicketWidget workbench={workbench} uri={placement.resource?.uri ?? placement.widgetId} />
      ),
    });

    ctx.renderers.registerRenderer({
      id: TREE_RENDERER_ID,
      render: () => <TreeWidget />,
    });

    ctx.layout.registerWidget({
      id: HOME_WIDGET_ID,
      title: "Navigation demo",
      region: "main",
      singleton: true,
      rendererId: HOME_RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: TICKET_WIDGET_ID,
      title: "Ticket",
      region: "main",
      closable: true,
      singleton: true,
      rendererId: TICKET_RENDERER_ID,
      resourceKinds: [TICKET_KIND],
    });

    ctx.layout.registerWidget({
      id: TREE_WIDGET_ID,
      title: "Workspace tree",
      region: "sidenav",
      regionSize: { defaultPx: 240, minPx: 200 },
      singleton: true,
      rendererId: TREE_RENDERER_ID,
    });

    // Short view ids that callers use in URLs, mapped to the real widget id
    // registered above. Keeps demo URLs readable.
    const viewIdByAlias: Record<string, string> = {
      "workspace-tree": TREE_WIDGET_ID,
    };
    const resolveViewId = (alias: string) => viewIdByAlias[alias] ?? alias;

    ctx.navigation.registerParser({
      id: "navigation.example.parser",
      canParse: (location) => location.startsWith("nav://"),
      parse: (location) => {
        const url = new URL(location);
        if (url.host === "resource") {
          const id = url.searchParams.get("id") ?? "PS-000";
          return {
            kind: "resource",
            resource: {
              kind: TICKET_KIND,
              uri: `${TICKET_KIND}:${id}`,
              id,
              label: `Ticket ${id}`,
              icon: "component",
            },
          };
        }
        if (url.host === "view") {
          const alias = url.searchParams.get("id") ?? "";
          return { kind: "view", widgetId: resolveViewId(alias) };
        }
        if (url.host === "command") {
          const id = url.searchParams.get("id") ?? "";
          return { kind: "command", commandId: id };
        }
        if (url.host === "open") {
          const ticketParam = url.searchParams.get("resource");
          const viewParam = url.searchParams.get("view");
          const ticketId = ticketParam?.split(":")[1] ?? "PS-000";
          return {
            kind: "compound",
            targets: [
              {
                kind: "resource",
                resource: {
                  kind: TICKET_KIND,
                  uri: `${TICKET_KIND}:${ticketId}`,
                  id: ticketId,
                  label: `Ticket ${ticketId}`,
                  icon: "component",
                },
              },
              {
                kind: "view",
                widgetId: resolveViewId(viewParam ?? "workspace-tree"),
              },
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

    ctx.panels.setPersistenceScope(AGGREGATE_SCOPE);
    ctx.layout.setPersistenceScope(AGGREGATE_SCOPE);
    ctx.layout.openWidget(HOME_WIDGET_ID);
  },
});
