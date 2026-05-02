import { CloseButton, Dialog, HStack, Input, InputGroup, Kbd, Stack, Text } from "@chakra-ui/react";
import { Folder, KanbanSquare, MessageSquare, Search, Settings, Ticket } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { ListRow } from "../list-row/list-row";
import type { ListRowItem } from "../list-row/list-row.types";
import { ScrollArea } from "../scroll-area";
import type { WorkspaceTicket } from "../tickets/types";
import { mockProjects, mockSessions, mockTickets } from "./mock-data";

type PaletteGroup = "navigation" | "tickets" | "sessions" | "projects";

interface PaletteEntry {
  group: PaletteGroup;
  item: ListRowItem;
}

export interface CommandPaletteHandlers {
  onOpenTickets: () => void;
  onOpenSessions: () => void;
  onOpenProjectSettings: () => void;
  onOpenGlobalSettings: () => void;
  onOpenProjects: () => void;
  onSelectTicket: (ticket: WorkspaceTicket) => void;
  onSelectSession: (sessionId: string) => void;
}

interface CommandPaletteProps extends CommandPaletteHandlers {
  open: boolean;
  onClose: () => void;
}

const groupOrder: PaletteGroup[] = ["navigation", "tickets", "sessions", "projects"];
const groupLabels: Record<PaletteGroup, string> = {
  navigation: "Navigation",
  tickets: "Tickets",
  sessions: "Sessions",
  projects: "Projects",
};

const buildEntries = (handlers: CommandPaletteHandlers): PaletteEntry[] => [
  {
    group: "navigation",
    item: {
      id: "nav:tickets",
      label: "Open tickets",
      description: "Project board",
      icon: <KanbanSquare size={14} />,
      onActivate: handlers.onOpenTickets,
    },
  },
  {
    group: "navigation",
    item: {
      id: "nav:sessions",
      label: "Open sessions",
      description: "Conversation history",
      icon: <MessageSquare size={14} />,
      onActivate: handlers.onOpenSessions,
    },
  },
  {
    group: "navigation",
    item: {
      id: "nav:project-settings",
      label: "Open project settings",
      icon: <Settings size={14} />,
      onActivate: handlers.onOpenProjectSettings,
    },
  },
  {
    group: "navigation",
    item: {
      id: "nav:global-settings",
      label: "Open global settings",
      icon: <Settings size={14} />,
      onActivate: handlers.onOpenGlobalSettings,
    },
  },
  {
    group: "navigation",
    item: {
      id: "nav:projects",
      label: "All projects",
      icon: <Folder size={14} />,
      onActivate: handlers.onOpenProjects,
    },
  },
  ...mockTickets.map<PaletteEntry>((ticket) => ({
    group: "tickets",
    item: {
      id: `ticket:${ticket.id}`,
      label: ticket.title,
      description: ticket.ticketId,
      icon: <Ticket size={14} />,
      onActivate: () => handlers.onSelectTicket(ticket),
    },
  })),
  ...mockSessions.map<PaletteEntry>((session) => ({
    group: "sessions",
    item: {
      id: `session:${session.id}`,
      label: session.title,
      description: session.preview,
      icon: <MessageSquare size={14} />,
      onActivate: () => handlers.onSelectSession(session.id),
    },
  })),
  ...mockProjects.map<PaletteEntry>((project) => ({
    group: "projects",
    item: {
      id: `project:${project.id}`,
      label: project.name,
      description: project.repoPath,
      icon: <Folder size={14} />,
      onActivate: handlers.onOpenProjects,
    },
  })),
];

const matches = (entry: PaletteEntry, q: string) => {
  if (!q) return true;
  const description = typeof entry.item.description === "string" ? entry.item.description : "";
  const label = typeof entry.item.label === "string" ? entry.item.label : "";
  return `${label} ${description}`.toLowerCase().includes(q.toLowerCase());
};

export const CommandPalette = (props: CommandPaletteProps) => {
  const { open, onClose, ...handlers } = props;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = buildEntries(handlers);
  const filtered = entries.filter((entry) => matches(entry, query));

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [open]);

  const runActive = () => {
    const entry = filtered[activeIndex];
    if (!entry) return;
    entry.item.onActivate?.();
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runActive();
    }
  };

  let cursor = -1;

  return (
    <Dialog.Root open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner alignItems="flex-start" pt="10vh">
        <Dialog.Content maxW="44rem" p="0" overflow="hidden">
          <Dialog.Header px="0" py="0" borderBottomWidth="1px" borderColor="border.muted">
            <InputGroup startElement={<Search size={16} />}>
              <Input
                ref={inputRef}
                value={query}
                placeholder="Search tickets, sessions, projects…"
                aria-label="Command palette search"
                autoComplete="off"
                borderWidth="0"
                borderRadius="0"
                h="3rem"
                _focus={{ boxShadow: "none" }}
                _focusVisible={{ boxShadow: "none" }}
                css={{ "&::selection": { backgroundColor: "transparent", color: "inherit" } }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </InputGroup>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" mr="2" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body p="0">
            <ScrollArea maxH="24rem" showHorizontalScrollbar={false}>
              <Stack gap="0">
                {filtered.length === 0 ? (
                  <Text textStyle="paragraph/S/regular" color="fg.muted" px="sm" py="md">
                    No results.
                  </Text>
                ) : (
                  groupOrder.map((group) => {
                    const groupEntries = filtered.filter((entry) => entry.group === group);
                    if (groupEntries.length === 0) return null;
                    return (
                      <Stack key={group} gap="0">
                        <Text textStyle="label/XS" color="fg.muted" px="sm" py="2xs">
                          {groupLabels[group]}
                        </Text>
                        {groupEntries.map((entry) => {
                          cursor += 1;
                          const isActive = cursor === activeIndex;
                          const indexForRow = cursor;
                          const itemWithSlot: ListRowItem = isActive
                            ? { ...entry.item, endContent: <Kbd size="sm">↵</Kbd> }
                            : entry.item;
                          return (
                            <ListRow
                              key={entry.item.id}
                              {...itemWithSlot}
                              isSelected={isActive}
                              onActivate={() => {
                                entry.item.onActivate?.();
                                onClose();
                              }}
                              onPointerMove={() => setActiveIndex(indexForRow)}
                            />
                          );
                        })}
                      </Stack>
                    );
                  })
                )}
              </Stack>
            </ScrollArea>
          </Dialog.Body>
          <Dialog.Footer justifyContent="space-between" px="sm" py="xs" borderTopWidth="1px" borderColor="border.muted">
            <HStack gap="2" color="fg.muted">
              <Text textStyle="label/XS">Open palette</Text>
              <Kbd size="sm">Mod</Kbd>
              <Kbd size="sm">K</Kbd>
            </HStack>
            <HStack gap="2" color="fg.muted">
              <Kbd size="sm">↵</Kbd>
              <Text textStyle="label/XS">to open</Text>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
