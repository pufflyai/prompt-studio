import { Badge, Box, Button, Spinner, Stack, Text, Wrap } from "@chakra-ui/react";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";

const READ_STATUSES = "pstdio-core-tickets.ticketStatus.read";
const READ_TAGS = "pstdio-core-tickets.ticketTag.read";
const UPDATE_TICKET = "pstdio-core-tickets.update-ticket";
const SET_TAGS = "pstdio-core-tickets.set-ticket-tags";

export interface TicketProperties {
  id: string;
  shorthand: string;
  statusId: string | null;
  tagIds?: string[];
  parentId?: string | null;
  dependsOn?: string | null;
  blockedReason?: string | null;
  archived?: boolean;
  updatedAt: string;
}

interface StatusDef {
  id: string;
  name: string;
  color: string;
}
interface TagOptionDef {
  id: string;
  name: string;
  color: string;
}
interface TagDef {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
  options: TagOptionDef[];
}

const value = (response: unknown) => (response as { outcome?: { value?: unknown } }).outcome?.value;

const Field = (props: { label: string; children: React.ReactNode }) => (
  <Stack gap="2xs">
    <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase">
      {props.label}
    </Text>
    {props.children}
  </Stack>
);

export const TicketPropertiesPanel = (props: { host: GuestHost; ticket: TicketProperties; onChanged: () => void }) => {
  const { host, ticket, onChanged } = props;
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [tags, setTags] = useState<TagDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [statusRes, tagRes] = await Promise.all([
        host.call("commands.execute", { commandId: READ_STATUSES }),
        host.call("commands.execute", { commandId: READ_TAGS }),
      ]);
      if (cancelled) return;
      setStatuses(((value(statusRes) as { statuses?: StatusDef[] })?.statuses ?? []) as StatusDef[]);
      setTags(((value(tagRes) as { tags?: TagDef[] })?.tags ?? []) as TagDef[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const setStatus = async (statusId: string) => {
    await host.call("commands.execute", { commandId: UPDATE_TICKET, params: { id: ticket.id, statusId } });
    onChanged();
  };

  const toggleTagOption = async (tag: TagDef, optionId: string) => {
    const optionIds = new Set(tag.options.map((option) => option.id));
    const current = ticket.tagIds ?? [];
    const others = current.filter((id) => !optionIds.has(id));
    const selectedForTag = current.filter((id) => optionIds.has(id));
    const isSelected = selectedForTag.includes(optionId);
    const nextForTag =
      tag.type === "single_select"
        ? isSelected
          ? []
          : [optionId]
        : isSelected
          ? selectedForTag.filter((id) => id !== optionId)
          : [...selectedForTag, optionId];
    await host.call("commands.execute", {
      commandId: SET_TAGS,
      params: { rowId: ticket.id, tagIds: [...others, ...nextForTag] },
    });
    onChanged();
  };

  if (loading) {
    return (
      <Box w="260px" borderLeftWidth="1px" borderColor="border" p="md">
        <Spinner size="sm" />
      </Box>
    );
  }

  const selected = new Set(ticket.tagIds ?? []);

  return (
    <Box w="260px" minW="260px" borderLeftWidth="1px" borderColor="border" p="md" overflow="auto">
      <Stack gap="md">
        <Text textStyle="label/M/medium">Properties</Text>

        <Field label="ID">
          <Text textStyle="paragraph/S/regular">{ticket.shorthand}</Text>
        </Field>

        <Field label="Updated">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {new Date(ticket.updatedAt).toLocaleString()}
          </Text>
        </Field>

        <Field label="Status">
          <Wrap gap="2xs">
            {statuses.map((status) => (
              <Button
                key={status.id}
                size="2xs"
                variant={ticket.statusId === status.id ? "solid" : "outline"}
                colorPalette={status.color}
                onClick={() => void setStatus(status.id)}
              >
                {status.name}
              </Button>
            ))}
          </Wrap>
        </Field>

        {tags.map((tag) => (
          <Field key={tag.id} label={tag.name}>
            <Wrap gap="2xs">
              {tag.options.map((option) => (
                <Button
                  key={option.id}
                  size="2xs"
                  variant={selected.has(option.id) ? "solid" : "outline"}
                  colorPalette={option.color}
                  onClick={() => void toggleTagOption(tag, option.id)}
                >
                  {option.name}
                </Button>
              ))}
            </Wrap>
          </Field>
        ))}

        {ticket.parentId ? (
          <Field label="Parent">
            <Text textStyle="paragraph/S/regular">{ticket.parentId}</Text>
          </Field>
        ) : null}

        {ticket.dependsOn ? (
          <Field label="Depends on">
            <Text textStyle="paragraph/S/regular">{ticket.dependsOn}</Text>
          </Field>
        ) : null}

        {ticket.archived ? (
          <Badge colorPalette="orange" variant="subtle" alignSelf="flex-start">
            Archived
          </Badge>
        ) : null}
      </Stack>
    </Box>
  );
};
