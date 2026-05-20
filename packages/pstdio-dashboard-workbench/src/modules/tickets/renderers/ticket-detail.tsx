import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfacePanel } from "@/services/components/surface";
import { dashboardViewResource } from "@/services/workbench/resources/resource-kinds";
import { useTicketStatuses, useTickets } from "../hooks/use-tickets";

const Field = (props: { label: string; children: React.ReactNode }) => (
  <Stack gap="2xs">
    <Text textStyle="label/S/semibold" color="fg.muted" textTransform="uppercase">
      {props.label}
    </Text>
    {props.children}
  </Stack>
);

export const TicketDetail = (props: { input: WorkbenchWidgetRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const shorthand = input.placement.resource?.id;
  const tickets = useTickets(projectId);
  const statuses = useTicketStatuses(projectId);

  const ticket = tickets.find((entry) => entry.shorthand === shorthand);

  if (!ticket) {
    return (
      <SurfacePanel title={shorthand ?? "Ticket"}>
        <EmptyState title="Ticket not found" description={`No synced ticket matches ${shorthand ?? "this id"}.`} />
      </SurfacePanel>
    );
  }

  const status = statuses.find((entry) => entry.id === ticket.statusId);

  return (
    <SurfacePanel
      title={ticket.title}
      subtitle={ticket.shorthand}
      actions={
        <Button
          size="xs"
          variant="outline"
          onClick={() => void input.workbench.resources.openResource(dashboardViewResource("workspaces"))}
        >
          Workspaces
        </Button>
      }
    >
      <Stack gap="lg" maxW="720px">
        <HStack gap="sm">
          <Badge colorPalette={status?.color ?? "gray"}>{status?.name ?? "No status"}</Badge>
          {ticket.draft ? <Badge colorPalette="gray">Draft</Badge> : null}
          {ticket.archived ? <Badge colorPalette="orange">Archived</Badge> : null}
        </HStack>

        {ticket.blockedReason ? (
          <Field label="Blocked">
            <Text textStyle="paragraph/S/regular" color="orange.fg">
              {ticket.blockedReason}
            </Text>
          </Field>
        ) : null}

        <Field label="Prompt">
          <Text textStyle="paragraph/M/regular" whiteSpace="pre-wrap">
            {ticket.prompt ?? "No prompt provided."}
          </Text>
        </Field>

        <Field label="Updated">
          <Text textStyle="paragraph/S/regular">{ticket.updatedAt ?? "—"}</Text>
        </Field>
      </Stack>
    </SurfacePanel>
  );
};
