import type { usePluginActionTrigger } from "../hooks/use-plugin-action-trigger";
import { ActionParamsDialog } from "./action-params-dialog";

export const ActionParamsModal = (props: {
  projectId: string;
  actionTrigger: ReturnType<typeof usePluginActionTrigger>;
}) => {
  const { projectId, actionTrigger } = props;

  if (!actionTrigger.activeParamAction) {
    return null;
  }

  return (
    <ActionParamsDialog
      open
      action={actionTrigger.activeParamAction}
      projectId={projectId}
      isSubmitting={actionTrigger.activeParamActionIsPending}
      onClose={actionTrigger.cancelParams}
      onSubmit={(params) => actionTrigger.submitWithParams(params)}
    />
  );
};
