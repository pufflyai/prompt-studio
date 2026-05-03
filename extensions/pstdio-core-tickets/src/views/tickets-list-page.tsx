import { Button, Container, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { StatusBadge, type TicketStatus } from "../components/status-badge";
import { TicketCard } from "../components/ticket-card";
import { TicketsHostBridge } from "../components/tickets-host-bridge";

interface MockTicket {
  id: string;
  shorthand: string;
  title: string;
  summary: string;
  status: TicketStatus;
}

const TICKETS: MockTicket[] = [
  {
    id: "PS-101",
    shorthand: "PS-101",
    title: "Wire ticket slots into the dashboard",
    summary: "Mount ExtensionMenuSlot hosts on the tickets list and detail headers.",
    status: "wip",
  },
  {
    id: "PS-102",
    shorthand: "PS-102",
    title: "Migrate code-review lifecycle plugin",
    summary: "Translate pre/post attempt-status hooks once the kernel emits the events.",
    status: "review",
  },
  {
    id: "PS-103",
    shorthand: "PS-103",
    title: "Define attempt-status kernel event",
    summary: "Add pstdio.attempts.statusChanged so workflow extensions can subscribe.",
    status: "todo",
  },
  {
    id: "PS-104",
    shorthand: "PS-104",
    title: "Expose createAttempt on extension ctx",
    summary: "Currently no ExtensionAttemptsApi exists — ticket commands stub via createSession.",
    status: "blocked",
  },
  {
    id: "PS-105",
    shorthand: "PS-105",
    title: "Auto-install pstdio-core-* on project create",
    summary: "Mirror pstdio-core-skills/templates auto-install for the new core extensions.",
    status: "done",
  },
];

const buildDetailHref = (ticketId: string) => `./ticket-page.html?id=${encodeURIComponent(ticketId)}`;

export const TicketsListPage = () => {
  return (
    <Container className="tickets-page" as="main" maxW="5xl" paddingX="lg" paddingY="lg">
      <TicketsHostBridge />
      <Stack gap="lg">
        <Stack gap="xs">
          <Text textStyle="label/XS/medium" color="fg.accent-primary">
            Core Tickets
          </Text>
          <HStack justify="space-between" align="flex-start" gap="md">
            <Stack gap="xs" flex="1">
              <Heading as="h1" textStyle="heading/L/bold">
                Tickets
              </Heading>
              <Text textStyle="paragraph/M/regular" color="fg.muted" maxW="2xl">
                Mock list view shipped by pstdio-core-tickets — hard-coded data, kept in sync with the slots this
                extension declares.
              </Text>
            </Stack>
            <Button variant="solid">New ticket</Button>
          </HStack>
        </Stack>

        <Grid templateColumns="1fr" gap="md">
          {TICKETS.map((ticket) => (
            <TicketCard key={ticket.id} title={ticket.title} subtitle={`${ticket.shorthand} · ${ticket.summary}`}>
              <HStack justify="space-between" align="center" gap="md">
                <StatusBadge status={ticket.status} />
                <Button as="a" variant="ghost" size="sm" {...{ href: buildDetailHref(ticket.id) }}>
                  Open
                </Button>
              </HStack>
            </TicketCard>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
};
