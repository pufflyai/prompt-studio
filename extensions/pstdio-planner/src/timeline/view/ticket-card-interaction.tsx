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
      onActions: (listed) => {
        setActions(listed);
        setError(undefined);
      },
      onError: (reason) => setError(String(reason)),
    });
    setLoader(next);
    return () => next.dispose();
  }, [host]);
  useEffect(() => {
    if (resource) loader?.load(resource);
  }, [loader, resource]);
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
  // Any use of the card replaces a list that a change has made stale; an open menu updates in place.
  const refresh = () => {
    if (resource) loader?.refresh(resource);
  };
  return { actions: menuActions, refresh, onBadgeChange, error };
}

export function TicketCardError(props: { error?: string }) {
  const { error } = props;
  return error ? (
    <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
      {error}
    </Text>
  ) : null;
}
