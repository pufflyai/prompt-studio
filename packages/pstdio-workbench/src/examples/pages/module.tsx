import { Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import {
  type ResourceRef,
  type WorkbenchCore,
  type WorkbenchModuleContribution,
  workbenchEmitResourceCommandId,
} from "../../core";

// Demonstrates the pages model end to end: a page composes the bench from slots,
// its bindings route emitted resources into a bound slot, and navigation targets
// the page (never a panel or a resource directly).

const PAGE_ID = "pages.example.page";
const BOARD_PANEL_ID = "pages.example.board";
const BOARD_RENDERER_ID = "pages.example.board.renderer";
const EDITOR_PANEL_ID = "pages.example.editor";
const EDITOR_RENDERER_ID = "pages.example.editor.renderer";
const TREE_ID = "pages.example.tree";
const TREE_SLOT_ID = "tree";
const TICKET_KIND = "pages.example.ticket";

const tickets = [
  { id: "PS-101", title: "Fix login redirect" },
  { id: "PS-102", title: "Add dark theme" },
  { id: "PS-103", title: "Speed up search" },
] as const;

const ticketResource = (ticket: (typeof tickets)[number]): ResourceRef => ({
  kind: TICKET_KIND,
  uri: `${TICKET_KIND}:${ticket.id}`,
  id: ticket.id,
  label: ticket.id,
  icon: "component",
  metadata: { title: ticket.title },
});

const BoardWidget = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  return (
    <Stack p="lg" gap="md">
      <Text textStyle="title/S/semibold">Ticket board</Text>
      <Text textStyle="paragraph/M/regular">
        This board fills a static, unclosable slot of the page. Emitting a resource routes it through the active
        page&apos;s bindings into the bound editor slot: a plain emission opens a preview tab that the next emission
        swaps, while pinning stacks a persistent tab.
      </Text>
      <Stack gap="sm">
        {tickets.map((ticket) => (
          <HStack key={ticket.id} gap="sm" wrap="wrap">
            <Text textStyle="label/S/semibold" minW="200px">
              {ticket.id} — {ticket.title}
            </Text>
            <Button size="sm" onClick={() => void workbench.pages.emitResource(ticketResource(ticket))}>
              Open {ticket.id}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void workbench.pages.emitResource(ticketResource(ticket), { open: "pin" })}
            >
              Pin {ticket.id}
            </Button>
          </HStack>
        ))}
      </Stack>
    </Stack>
  );
};

const EditorWidget = (props: { resource: ResourceRef | undefined }) => {
  const { resource } = props;
  return (
    <Stack p="lg" gap="sm" bg="bg" h="full">
      <Text textStyle="title/S/semibold">
        {resource?.label ?? "Ticket"}
        {typeof resource?.metadata?.title === "string" ? ` — ${resource.metadata.title}` : ""}
      </Text>
      <Text textStyle="paragraph/M/regular">
        The page binds the ticket kind to this editor panel, so every emitted ticket lands here.
      </Text>
      <Code colorPalette="gray">{resource?.uri ?? "no resource"}</Code>
    </Stack>
  );
};

export const createPagesExampleModule = (): WorkbenchModuleContribution => ({
  id: "pages.example",
  activate(ctx) {
    ctx.resources.registerKind({ kind: TICKET_KIND, label: "Ticket", icon: "component" });

    ctx.renderers.registerRenderer({
      id: BOARD_RENDERER_ID,
      render: ({ workbench }) => <BoardWidget workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: EDITOR_RENDERER_ID,
      render: ({ instance }) => <EditorWidget resource={instance.resource} />,
    });
    // Tree rows only speak navigation targets, so emissions compile to the
    // built-in emit-resource command; the header row targets the page itself.
    ctx.renderers.registerTreeRenderer({
      id: TREE_ID,
      title: "Tickets",
      defaultExpandedSectionIds: ["tickets"],
      getHeader: () => [
        {
          id: "page",
          label: "Tickets page",
          icon: "SquareKanban",
          target: { kind: "page", pageId: PAGE_ID },
        },
      ],
      getBody: () => [
        {
          id: "tickets",
          label: "Tickets",
          nodes: tickets.map((ticket) => ({
            id: ticket.id,
            label: `${ticket.id} — ${ticket.title}`,
            icon: "component",
            target: {
              kind: "command",
              commandId: workbenchEmitResourceCommandId,
              args: { resource: ticketResource(ticket) },
            },
          })),
        },
      ],
      getChildren: () => [],
    });

    ctx.layout.registerPanel({
      id: BOARD_PANEL_ID,
      title: "Board",
      region: "main",
      singleton: true,
      rendererId: BOARD_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      id: EDITOR_PANEL_ID,
      title: "Ticket",
      region: "main",
      singleton: false,
      resourceKinds: [TICKET_KIND],
      rendererId: EDITOR_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      id: TREE_ID,
      title: "Tickets",
      region: "sidenav",
      singleton: true,
      regionSize: { defaultPx: 260, minPx: 220 },
      rendererId: TREE_ID,
    });

    ctx.pages.registry.registerPage({
      id: PAGE_ID,
      title: "Tickets",
      icon: "SquareKanban",
      slots: [
        { id: "board", region: "main", panelId: BOARD_PANEL_ID, closable: false, order: 0 },
        { id: "editors", region: "main", cardinality: "many", order: 1 },
        { id: TREE_SLOT_ID, region: "sidenav", panelId: TREE_ID, order: 0 },
      ],
      bindings: [{ kind: TICKET_KIND, panelId: EDITOR_PANEL_ID, slot: "editors" }],
    });

    void ctx.pages.activatePage(PAGE_ID);
  },
});
