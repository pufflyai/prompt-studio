import { Icon, Text } from "@chakra-ui/react";
import type { GuestHost, WebviewResourceAction } from "@pstdio/sdk/extensions";
import { getIconComponent, type ResourceContextAction } from "@pstdio/ui";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import { useEffect, useState } from "react";
import type { TimelineTicketRow } from "../model/query-data";
import { createTicketCardActions } from "./ticket-card-actions";
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
  const [actions, setActions] = useState<WebviewResourceAction[]>([]);
  const [error, setError] = useState<string>();
  const [loader, setLoader] = useState<ReturnType<typeof createTicketCardActions>>();
  const host = interaction?.host;
  const resource = row?.resource;
  useEffect(() => {
    if (!host) return;
    const next = createTicketCardActions(host, {
      onActions: setActions,
      onError: (reason) => setError(String(reason)),
    });
    setLoader(next);
    return () => next.dispose();
  }, [host]);
  const menuActions: ResourceContextAction[] =
    host && resource
      ? actions.map((action) => ({
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
        }))
      : [];
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
  // Hover and focus come before a context menu opens, so its actions are ready by then.
  const prepare = () => {
    if (resource) loader?.prepare(resource);
  };
  return { actions: menuActions, prepare, onBadgeChange, error };
}

export function TicketCardError(props: { error?: string }) {
  const { error } = props;
  return error ? (
    <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
      {error}
    </Text>
  ) : null;
}
