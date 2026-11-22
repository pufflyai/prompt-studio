import { Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useActionError } from "@/shared/components/use-action-error";
import {
  useExtensionProcessEnvironment,
  useGrantExtensionProcessEnvironment,
  useRevokeExtensionProcessEnvironment,
} from "../data/use-extension-process-environment";
import { ExtensionEnvironmentAccess } from "./extension-environment-access";

export const ExtensionEnvironmentAccessSection = (props: { projectId: string; extensionId: string }) => {
  const { projectId, extensionId } = props;
  const { t } = useTranslation("projects");
  const { showError, clearError, errorNotice } = useActionError();
  const permission = useExtensionProcessEnvironment(projectId, extensionId);
  const grant = useGrantExtensionProcessEnvironment(projectId, extensionId);
  const revoke = useRevokeExtensionProcessEnvironment(projectId, extensionId);
  const notifyError = (error: Error) =>
    showError({
      title: t("projectSettings.extensionsPanel.environmentAccess.actionFailed"),
      description: error.message,
    });

  if (permission.isError)
    return (
      <Text textStyle="label/XS" color="fg.error">
        {t("projectSettings.extensionsPanel.environmentAccess.loadError")}
      </Text>
    );
  if (!permission.data) return null;
  const current = permission.data;

  let pending: "grant" | "revoke" | undefined;
  if (grant.isPending) pending = "grant";
  else if (revoke.isPending) pending = "revoke";

  return (
    <ExtensionEnvironmentAccess
      key={`${current.sourceIdentity}:${current.granted.join(",")}`}
      permission={current}
      pending={pending}
      errorNotice={errorNotice}
      onAllow={(names) => {
        clearError();
        grant.mutate({ names, sourceIdentity: current.sourceIdentity }, { onError: notifyError });
      }}
      onRevoke={() => {
        clearError();
        revoke.mutate(undefined, { onError: notifyError });
      }}
    />
  );
};
