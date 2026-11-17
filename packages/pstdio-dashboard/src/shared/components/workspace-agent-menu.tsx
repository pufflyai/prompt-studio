import { HarnessModelMenu, type HarnessModelMenuProps } from "@pstdio/ui/param-editor";
import { useTranslation } from "react-i18next";

export type { WorkspacePanelMenuOption } from "@pstdio/ui/param-editor";

export const WorkspaceAgentMenu = (props: HarnessModelMenuProps) => {
  const { t } = useTranslation("projects");
  return (
    <HarnessModelMenu
      {...props}
      labels={{
        agentSelect: t("chatInput.agent.selectLabel"),
        agentUnknown: t("chatInput.agent.unknown"),
        agentLoading: t("chatInput.agent.loading"),
        modelSelect: t("chatInput.model.selectLabel"),
        modelNone: t("chatInput.model.none"),
        modelNoneAvailable: t("chatInput.model.noneAvailable"),
        modelLoading: t("chatInput.model.loading"),
        modelSearchPlaceholder: t("chatInput.model.searchPlaceholder"),
        ...props.labels,
      }}
    />
  );
};
