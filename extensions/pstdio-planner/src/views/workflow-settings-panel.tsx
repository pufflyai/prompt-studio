import { createWebviewClient, defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage } from "@pstdio/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { readWorkflowStatusesCommand, saveWorkflowStatusesCommand } from "../commands/workflow-statuses";
import { renderTicketRoot } from "./view-root";
import { WorkflowSettingsForm } from "./workflow-settings-form";

type Commands = {
  "workflow-statuses.read": typeof readWorkflowStatusesCommand;
  "workflow-statuses.save": typeof saveWorkflowStatusesCommand;
};
function WorkflowSettingsPanel(props: { host: GuestHost }) {
  const { host } = props;
  const client = createWebviewClient<Commands>(host);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["workflow-statuses"],
    queryFn: () => client.commands["workflow-statuses.read"](),
  });
  if (query.error) return <AlertMessage status="error" title={query.error.message} />;
  if (!query.data) return null;
  return (
    <WorkflowSettingsForm
      selections={query.data.selections}
      statuses={query.data.statuses}
      onSave={async (selections) => {
        const saved = await client.commands["workflow-statuses.save"]({ selections });
        queryClient.setQueryData(["workflow-statuses"], saved);
      }}
    />
  );
}
export default defineExtensionView({
  render({ mount, host }) {
    return renderTicketRoot(mount, <WorkflowSettingsPanel host={host} />);
  },
});
