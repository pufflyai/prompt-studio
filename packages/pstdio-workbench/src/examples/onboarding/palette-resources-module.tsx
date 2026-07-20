import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { CommandPaletteResourceResult, ResourceRef, WorkbenchModuleContribution } from "../../core";
import { WorkbenchIcon } from "../../react";

const PANEL_WIDGET_ID = "onboarding.palette-resources.panel";
const PANEL_RENDERER_ID = "onboarding.palette-resources.panel.renderer";
const TICKET_WIDGET_ID = "onboarding.palette-resources.ticket";
const TICKET_RENDERER_ID = "onboarding.palette-resources.ticket.renderer";
const TICKET_KIND = "onboarding.palette.ticket";

const tickets = [
  { id: "PS-101", label: "PS-101 Palette resource providers", status: "Ready", keywords: ["palette", "search"] },
  { id: "PS-118", label: "PS-118 Extension search bridge", status: "Review", keywords: ["extension", "bridge"] },
  { id: "PS-144", label: "PS-144 Resource activation", status: "Draft", keywords: ["resource", "open"] },
] as const;

const ticketResource = (ticket: (typeof tickets)[number]): ResourceRef => ({
  kind: TICKET_KIND,
  uri: `${TICKET_KIND}:${ticket.id}`,
  id: ticket.id,
  label: ticket.label,
  icon: "Ticket",
  metadata: { status: ticket.status },
});

const matchesTicket = (ticket: (typeof tickets)[number], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [ticket.id, ticket.label, ticket.status, ...ticket.keywords].some((value) =>
    value.toLowerCase().includes(normalized),
  );
};

const PaletteResourcesPanel = (props: { onOpenPalette: () => void; onRefresh: () => void }) => {
  const { onOpenPalette, onRefresh } = props;

  return (
    <ScrollArea h="full" minH="0" bg="bg" color="fg" contentProps={{ p: "lg" }}>
      <Stack gap="lg" maxW="720px">
        <HStack gap="sm" wrap="wrap">
          <Badge colorPalette="blue">Tickets provider</Badge>
          <Badge colorPalette="green">Actions provider</Badge>
        </HStack>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Palette providers add dynamic results to search mode. Results can open resources or run commands without being
          permanent command registrations.
        </Text>
        <HStack gap="sm" wrap="wrap">
          <Button size="sm" onClick={onOpenPalette}>
            <WorkbenchIcon name="Search" />
            Search PS
          </Button>
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <WorkbenchIcon name="RefreshCw" />
            Refresh providers
          </Button>
        </HStack>
      </Stack>
    </ScrollArea>
  );
};

const TicketPanel = (props: { resource?: ResourceRef }) => {
  const { resource } = props;
  const status = typeof resource?.metadata?.status === "string" ? resource.metadata.status : "Open";

  return (
    <Stack h="full" minH="0" bg="bg" color="fg" p="lg" gap="md">
      <HStack gap="sm" wrap="wrap">
        <Text textStyle="title/S/semibold">{resource?.id ?? "Ticket"}</Text>
        <Badge colorPalette="purple">{status}</Badge>
      </HStack>
      <Text textStyle="paragraph/M/regular" color="fg.muted">
        {resource?.label ?? "Select a palette result to open a ticket."}
      </Text>
    </Stack>
  );
};

export const createPaletteResourcesModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.palette-resources",
  activate(ctx) {
    ctx.resources.registerKind({ kind: TICKET_KIND, label: "Ticket", icon: "Ticket" });
    ctx.resources.registerOpener({
      id: "onboarding.palette-resources.ticket-opener",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource, input) =>
        ctx.layout.openWidget(TICKET_WIDGET_ID, {
          resource,
          title: resource.id ?? resource.label,
          replaceActive: input.replaceActive,
        }),
    });

    ctx.renderers.registerRenderer({
      id: PANEL_RENDERER_ID,
      render: ({ workbench }) => (
        <PaletteResourcesPanel
          onOpenPalette={() => workbench.commandPalette.open({ initialQuery: "PS" })}
          onRefresh={() => {
            workbench.commandPaletteResources.refresh();
            workbench.notifications.show({ level: "info", title: "Palette providers refreshed" });
          }}
        />
      ),
    });
    ctx.renderers.registerRenderer({
      id: TICKET_RENDERER_ID,
      render: ({ placement }) => <TicketPanel resource={placement.resource} />,
    });

    ctx.layout.registerWidget({
      id: PANEL_WIDGET_ID,
      title: "Palette resources",
      region: "main",
      rendererId: PANEL_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: TICKET_WIDGET_ID,
      title: "Ticket",
      region: "main",
      rendererId: TICKET_RENDERER_ID,
      singleton: false,
      resourceKinds: [TICKET_KIND],
    });

    ctx.commandPaletteResources.registerProvider({
      id: "onboarding.palette-resources.tickets",
      title: "Tickets",
      query: async ({ query, limit }) =>
        tickets
          .filter((ticket) => matchesTicket(ticket, query))
          .slice(0, limit)
          .map(
            (ticket): CommandPaletteResourceResult => ({
              id: ticket.id,
              label: ticket.label,
              description: ticket.status,
              icon: "Ticket",
              keywords: [...ticket.keywords],
              activate: () => {
                void ctx.resources.openResource(ticketResource(ticket), { replaceActive: true });
              },
            }),
          ),
    });

    ctx.commandPaletteResources.registerProvider({
      id: "onboarding.palette-resources.actions",
      title: "Actions",
      query: async ({ query }) => {
        if (query && !"create ticket".includes(query.toLowerCase())) return [];
        return [
          {
            id: "create-ticket",
            label: "Create ticket",
            description: "Runs a provider-owned command",
            icon: "Plus",
            activate: () => {
              ctx.notifications.show({ level: "success", title: "Ticket draft created" });
            },
          },
        ];
      },
    });

    ctx.layout.openWidget(PANEL_WIDGET_ID);
  },
});
