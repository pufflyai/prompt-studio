import { AlertMessage } from "@pstdio/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiClient } from "@/lib/api";
import { ExtensionExecutionControls } from "./extension-execution-controls";

export const ExtensionExecutionSection = (props: { projectId: string; instanceId: string }) => {
  const { projectId, instanceId } = props;
  const { t } = useTranslation("projects");
  const client = useQueryClient();
  const queryKey = ["extension-execution", projectId, instanceId];
  const execution = getApiClient().extensions.execution;
  const query = useQuery({ queryKey, queryFn: () => execution.get(projectId, instanceId) });
  const action = useMutation({
    mutationFn: (kind: "stop" | "restart") => execution[kind](projectId, instanceId),
    onSuccess: (state) => client.setQueryData(queryKey, state),
  });
  if (query.isError)
    return (
      <AlertMessage status="error" title={t("projectSettings.extensionsPanel.execution.unavailable")}>
        {query.error.message}
      </AlertMessage>
    );
  if (!query.data) return null;
  return (
    <ExtensionExecutionControls
      execution={query.data}
      pending={action.isPending}
      error={action.error?.message}
      onAction={(kind) => action.mutateAsync(kind)}
    />
  );
};
