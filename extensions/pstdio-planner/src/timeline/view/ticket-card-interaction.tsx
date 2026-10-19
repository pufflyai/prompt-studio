import { Icon, Text } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { getIconComponent, type ResourceContextAction } from "@pstdio/ui";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import { useEffect, useState } from "react";
import type { TimelineTicketRow } from "../model/query-data";
import type { PlanClient } from "./use-plan";

export interface TicketCardInteraction {
  host: GuestHost;
  client: PlanClient;
  rows: ReadonlyMap<string, TimelineTicketRow>;
  attributes: AttributeDescriptor[];
  displayProperties: string[];
}

export function useTicketCardActions(
  interaction: TicketCardInteraction | undefined,
  row: TimelineTicketRow | undefined,
) {
  const [actions, setActions] = useState<ResourceContextAction[]>([]);
  const [error, setError] = useState<string>();
  const host = interaction?.host;
  const resource = row?.resource;
  useEffect(() => {
    let active = true;
    if (!host || !resource) return;
    void host
      .call("resources.actions", { operation: "list", resource })
      .then((actions) => {
        if (!active) return;
        setActions(
          actions.map((action) => ({
            ...action,
            icon: action.icon ? <Icon as={getIconComponent(action.icon)} boxSize="4" /> : undefined,
            onClick: async () => {
              setError(undefined);
              try {
                await host.call("resources.actions", { operation: "execute", resource, key: action.key });
              } catch (reason) {
                setError(String(reason));
              }
            },
          })),
        );
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, [host, resource]);
  const onBadgeChange = async (attributeId: string, value: unknown) => {
    if (!interaction || !row) return;
    setError(undefined);
    try {
      await interaction.client.commands["set-ticket-attribute"]({
        rowId: row.id,
        attributeId,
        value: value as string | string[],
      });
    } catch (reason) {
      setError(String(reason));
    }
  };
  return { actions, onBadgeChange, error };
}

export function TicketCardError(props: { error?: string }) {
  const { error } = props;
  return error ? (
    <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
      {error}
    </Text>
  ) : null;
}
