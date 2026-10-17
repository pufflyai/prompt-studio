import { createWebviewClient, defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { type SaveTagSettingsInput, ScrollArea, type TagEditorValue, TagSettingsPanel } from "@pstdio/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { plannerTicketsChanged } from "../events";
import type { readStatusSettings, saveStatusSettings, TicketStatusDraft } from "../ticket-status-settings";
import { renderTicketRoot } from "./view-root";

type Commands = {
  "ticket-status.read-settings": typeof readStatusSettings;
  "ticket-status.save-settings": typeof saveStatusSettings;
};
const editorValue = (status: TicketStatusDraft): TagEditorValue => ({ ...status, name: status.label });
const statusValue = (draft: TagEditorValue): TicketStatusDraft => ({ ...draft, label: draft.name });
const needsUpdate = (status: TicketStatusDraft, draft: TagEditorValue) =>
  status.label !== draft.name ||
  status.color !== draft.color ||
  status.icon !== draft.icon ||
  status.isDefault !== draft.isDefault ||
  JSON.stringify(status.actions ?? []) !== JSON.stringify(draft.actions ?? []);

export const TicketStatusSettingsPanel = (props: { host: GuestHost }) => {
  const { host } = props;
  const client = createWebviewClient<Commands>(host);
  const cache = useQueryClient();
  const queryKey = ["ticket-status-settings"];
  const query = useQuery({
    queryKey,
    queryFn: async () => (await client.commands["ticket-status.read-settings"]()).statuses,
  });
  useEffect(
    () =>
      createWebviewClient<Commands>(host).events.subscribe(plannerTicketsChanged, () => {
        void cache.invalidateQueries({ queryKey: ["ticket-status-settings"] });
      }),
    [host, cache],
  );
  const save = async (input: SaveTagSettingsInput<TicketStatusDraft>) => {
    const result = await client.commands["ticket-status.save-settings"]({ statuses: input.drafts.map(statusValue) });
    cache.setQueryData(queryKey, result.statuses);
  };
  return (
    <ScrollArea h="full" minH="0">
      <TagSettingsPanel
        values={query.data}
        loadError={query.error}
        onSave={save}
        toEditorValue={editorValue}
        valueNeedsUpdate={needsUpdate}
        title="Ticket status"
        actionsLabel="Commands"
        actionOptions={[
          { value: "create", label: "Create" },
          { value: "archive_all", label: "Archive all" },
        ]}
        framed
        showColumnHeaders
        valueColumnLabel="State"
        showDefault
        errorTitle="Unable to update ticket statuses"
        addLabel="Add state"
        addName="New status"
        resetLabel="Reset"
        saveLabel="Save"
        deleteHeadline="Delete status?"
        deleteNotificationText={(status) => `This will delete the "${status.name}" status.`}
        deleteButtonText="Delete status"
      />
    </ScrollArea>
  );
};

export default defineExtensionView({
  render({ mount, host }) {
    return renderTicketRoot(mount, <TicketStatusSettingsPanel host={host} />);
  },
});
