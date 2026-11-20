import { Spinner, VisuallyHidden } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ExtensionActionState } from "./extension-action-feedback";

interface ExtensionToggleProps {
  name: string;
  enabled: boolean;
  action?: ExtensionActionState;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}

export const ExtensionToggle = (props: ExtensionToggleProps) => {
  const { name, enabled, action, disabled, onToggle } = props;
  const { t } = useTranslation("projects");
  const input = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const loading = action?.status === "running";
  useEffect(() => {
    if (!restoreFocus.current || disabled || loading) return;
    const element = input.current;
    if (!element || element.checked !== enabled || !element.getClientRects().length) return;
    restoreFocus.current = false;
    // Disabling a saving switch moves browser focus to the document. Restore that
    // keyboard position, while respecting a move to another control during the save.
    const active = element.ownerDocument.activeElement;
    if (active === element.ownerDocument.body || active === element) element.focus();
  }, [disabled, loading, enabled]);
  const spinner = loading && <Spinner size="xs" aria-hidden="true" data-testid="extension-toggle-spinner" />;

  return (
    <>
      <Switch
        ref={input}
        size="sm"
        checked={enabled}
        onCheckedChange={(details) => {
          restoreFocus.current = input.current?.ownerDocument.activeElement === input.current;
          onToggle(details.checked);
        }}
        disabled={disabled || loading}
        aria-label={t("projectSettings.extensionsPanel.toggleAriaLabel", { name })}
        inputProps={{ "aria-busy": loading || undefined }}
        thumbLabel={spinner ? { on: spinner, off: spinner } : undefined}
      />
      <VisuallyHidden role="status">{loading ? action.label : undefined}</VisuallyHidden>
    </>
  );
};
