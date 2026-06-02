import { Badge, Box, Button, Spinner, Stack, Text, Wrap } from "@chakra-ui/react";
import {
  type CommandResponse,
  type GuestHost,
  unwrapCommandOutcome,
  type WebviewFilesClient,
} from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { StoredTicketAttachment } from "../data/types";
import { nextTagSelection } from "./tag-selection";
import { TicketAttachments } from "./ticket-attachments";

const READ_STATUSES = "pstdio-core-tickets.ticketStatus.read";
const READ_TAGS = "pstdio-core-tickets.ticketTag.read";
const UPDATE_TICKET = "pstdio-core-tickets.update-ticket";
const SET_TAGS = "pstdio-core-tickets.set-ticket-tags";
const ATTACH_FILE = "pstdio-core-tickets.attach-file";

export interface TicketProperties {
  id: string;
  shorthand: string;
  statusId: string | null;
  tagIds?: string[];
  attachments?: StoredTicketAttachment[];
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

const Field = (props: { label: string; children: React.ReactNode }) => (
  <Stack gap="2xs">
    <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase">
      {props.label}
    </Text>
    {props.children}
  </Stack>
);

export const TicketPropertiesPanel = (props: {
  files: WebviewFilesClient;
  host: GuestHost;
  ticket: TicketProperties;
  onChanged: () => void;
}) => {
  const { files, host, ticket, onChanged } = props;
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [tags, setTags] = useState<TagDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [statusRes, tagRes] = await Promise.all([
        host.call<CommandResponse<{ statuses?: StatusDef[] }>>("commands.execute", { commandId: READ_STATUSES }),
        host.call<CommandResponse<{ tags?: TagDef[] }>>("commands.execute", { commandId: READ_TAGS }),
      ]);
      if (cancelled) return;
      setStatuses(unwrapCommandOutcome(statusRes).statuses ?? []);
      setTags(unwrapCommandOutcome(tagRes).tags ?? []);
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
    const current = ticket.tagIds ?? [];
    await host.call("commands.execute", {
      commandId: SET_TAGS,
      params: { rowId: ticket.id, tagIds: nextTagSelection({ current, optionId, tag }) },
    });
    onChanged();
  };

  const attachFiles = async () => {
    const picked = await files.pick({ multiple: true });
    for (const file of picked) {
      const ref = await files.upload({
        name: file.name,
        data: await file.arrayBuffer(),
        mimeType: file.type || undefined,
        scope: { type: "resource", id: ticket.id },
      });
      const response = await host.call<CommandResponse<unknown>>("commands.execute", {
        commandId: ATTACH_FILE,
        params: { ticketId: ticket.id, ref },
      });
      unwrapCommandOutcome(response);
    }
    if (picked.length > 0) onChanged();
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

        <TicketAttachments attachments={ticket.attachments} />

        <Button size="xs" variant="outline" onClick={() => void attachFiles()}>
          Attach files
        </Button>

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
