import { Box, Button, Container, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { StatusBadge, type TicketStatus } from "../components/status-badge";
import { TicketCard } from "../components/ticket-card";
import { TicketsHostBridge } from "../components/tickets-host-bridge";

const MOCK = {
  id: "PS-101",
  shorthand: "PS-101",
  title: "Wire ticket slots into the dashboard",
  status: "wip" as TicketStatus,
  owner: "au-re",
  tags: ["dashboard", "extensions", "ui"],
  body: [
    "Mount the new ticket-targeted slots from pstdio-core-tickets into the dashboard so menu contributions from other extensions actually render.",
    "List/board header (primary + overflow), per-row context menu, and the detail page header (primary + overflow) all need ExtensionMenuSlot hosts.",
    "This view is a mock placeholder shipped by the extension — it does not load a real ticket.",
  ],
};

export const TicketPage = () => {
  return (
    <Container className="tickets-page" as="main" maxW="5xl" paddingX="lg" paddingY="lg">
      <TicketsHostBridge />
      <Stack gap="lg">
        <Stack gap="xs">
          <Text textStyle="label/XS/medium" color="fg.accent-primary">
            {MOCK.shorthand}
          </Text>
          <HStack justify="space-between" align="flex-start" gap="md">
            <Heading as="h1" textStyle="heading/L/bold">
              {MOCK.title}
            </Heading>
            <Button variant="ghost">More actions</Button>
          </HStack>
        </Stack>

        <Grid templateColumns={{ base: "1fr", md: "1fr 240px" }} gap="md" alignItems="start">
          <TicketCard title="Description" subtitle="Mock body — not connected to real data.">
            <Stack gap="sm">
              {MOCK.body.map((paragraph) => (
                <Text key={paragraph} textStyle="paragraph/M/regular">
                  {paragraph}
                </Text>
              ))}
            </Stack>
          </TicketCard>

          <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="md" p="md" boxShadow="sm">
            <Stack gap="md">
              <Stack gap="2xs">
                <Text textStyle="label/XS/medium" color="fg.muted">
                  Status
                </Text>
                <StatusBadge status={MOCK.status} />
              </Stack>
              <Stack gap="2xs">
                <Text textStyle="label/XS/medium" color="fg.muted">
                  Owner
                </Text>
                <Text textStyle="paragraph/S/regular">{MOCK.owner}</Text>
              </Stack>
              <Stack gap="2xs">
                <Text textStyle="label/XS/medium" color="fg.muted">
                  Tags
                </Text>
                <Text textStyle="paragraph/S/regular">{MOCK.tags.join(", ")}</Text>
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Stack>
    </Container>
  );
};
