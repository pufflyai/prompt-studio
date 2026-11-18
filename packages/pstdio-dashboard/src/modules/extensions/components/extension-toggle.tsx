import { Spinner } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

interface ExtensionToggleProps {
  name: string;
  enabled: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}

export const ExtensionToggle = (props: ExtensionToggleProps) => {
  const { name, enabled, loading, disabled, onToggle } = props;
  const { t } = useTranslation("projects");
  const spinner = loading && <Spinner size="xs" aria-hidden="true" data-testid="extension-toggle-spinner" />;

  return (
    <Switch
      size="sm"
      checked={enabled}
      onCheckedChange={(details) => onToggle(details.checked)}
      disabled={disabled || loading}
      aria-label={t("projectSettings.extensionsPanel.toggleAriaLabel", { name })}
      inputProps={{ "aria-busy": loading || undefined }}
      thumbLabel={spinner ? { on: spinner, off: spinner } : undefined}
    />
  );
};
