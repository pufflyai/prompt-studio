import { DeleteConfirmationModal } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

interface ExtensionReplacementConfirmationProps {
  replacement: { name: string; retry: () => Promise<void> } | null;
  onClose: () => void;
}
export const ExtensionReplacementConfirmation = (props: ExtensionReplacementConfirmationProps) => {
  const { replacement, onClose } = props;
  const { t } = useTranslation("projects");
  return (
    <DeleteConfirmationModal
      open={replacement !== null}
      headline={t("projectSettings.extensionsPanel.replace.title", { name: replacement?.name })}
      notificationText={t("projectSettings.extensionsPanel.replace.message")}
      buttonText={t("projectSettings.extensionsPanel.replace.action")}
      onClose={onClose}
      onDelete={async () => {
        await replacement?.retry();
      }}
    />
  );
};
