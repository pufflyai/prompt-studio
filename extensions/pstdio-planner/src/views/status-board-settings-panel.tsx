import { Box, Flex, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ScrollArea, Switch } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StoredStatus } from "../data/types";
import { runCommand } from "../hooks/use-command";
import type { Translate } from "./tag-settings-section";
import { renderTicketRoot } from "./view-root";

const STATUSES_KEY = ["ticket-statuses"];

const commandIds = {
  read: "pstdio.pstdio-planner.command.ticket-status.read",
  update: "pstdio.pstdio-planner.command.ticket-status.update",
};

const readStatuses = async (host: GuestHost) =>
  (await runCommand<{ statuses: StoredStatus[] }>(host, commandIds.read, undefined, "Ticket status command failed."))
    .statuses;

type BoardRule = "canCreate" | "canDragIn" | "canDragOut";

interface StatusRuleRowProps {
  status: StoredStatus;
  t: Translate;
  disabled?: boolean;
  onChange: (rule: BoardRule, checked: boolean) => void;
}

export const StatusRuleRow = (props: StatusRuleRowProps) => {
  const { status, t, disabled = false, onChange } = props;
  return (
    <Stack
      gap="sm"
      borderTopWidth="1px"
      borderColor="border.subtle"
      py="md"
      data-testid={`status-board-rule-${status.id}`}
    >
      <Text textStyle="label/M/medium">{status.name}</Text>
      <HStack gap="lg" flexWrap="wrap">
        <Switch
          size="sm"
          checked={status.canCreate}
          disabled={disabled}
          onCheckedChange={({ checked }) => onChange("canCreate", checked === true)}
        >
          {t("settings.ticketBoard.canCreate", "Create in column")}
        </Switch>
        <Switch
          size="sm"
          checked={status.canDragIn}
          disabled={disabled}
          onCheckedChange={({ checked }) => onChange("canDragIn", checked === true)}
        >
          {t("settings.ticketBoard.canDragIn", "Drag in")}
        </Switch>
        <Switch
          size="sm"
          checked={status.canDragOut}
          disabled={disabled}
          onCheckedChange={({ checked }) => onChange("canDragOut", checked === true)}
        >
          {t("settings.ticketBoard.canDragOut", "Drag out")}
        </Switch>
      </HStack>
    </Stack>
  );
};

const StatusBoardSettingsPanel = (props: { host: GuestHost; t: Translate }) => {
  const { host, t } = props;
  const queryClient = useQueryClient();
  const statusesQuery = useQuery({ queryKey: STATUSES_KEY, queryFn: () => readStatuses(host) });
  const updateStatus = useMutation({
    mutationFn: (input: { statusId: string; rule: BoardRule; checked: boolean }) =>
      runCommand(host, commandIds.update, {
        statusId: input.statusId,
        [input.rule]: input.checked,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STATUSES_KEY }),
  });
  const error = statusesQuery.error ?? updateStatus.error;

  return (
    <ScrollArea h="full" minH="0" bg="bg" color="fg" contentProps={{ p: "lg", minH: "100%" }}>
      <Flex gap="sm" alignItems="flex-start" justifyContent="space-between" mb="lg">
        <Box minW="0">
          <Text textStyle="heading/M">{t("settings.ticketBoard.title", "Ticket board")}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("settings.ticketBoard.description", "Set the create and drag rules for each ticket column.")}
          </Text>
        </Box>
      </Flex>
      {error ? (
        <AlertMessage
          status="error"
          colorPalette="red"
          title={t("settings.ticketBoard.errorTitle", "Unable to update ticket board")}
          size="sm"
        >
          {error instanceof Error ? error.message : String(error)}
        </AlertMessage>
      ) : null}
      {statusesQuery.isPending ? (
        <HStack gap="sm" color="fg.muted">
          <Spinner size="sm" />
          <Text textStyle="paragraph/S/regular">{t("settings.ticketBoard.loading", "Loading...")}</Text>
        </HStack>
      ) : (
        <Stack gap="none">
          {(statusesQuery.data ?? []).map((status) => (
            <StatusRuleRow
              key={status.id}
              status={status}
              t={t}
              disabled={updateStatus.isPending}
              onChange={(rule, checked) => updateStatus.mutate({ statusId: status.id, rule, checked })}
            />
          ))}
        </Stack>
      )}
    </ScrollArea>
  );
};

export default defineExtensionView({
  render({ mount, host, t }) {
    return renderTicketRoot(mount, <StatusBoardSettingsPanel host={host} t={t} />);
  },
});
