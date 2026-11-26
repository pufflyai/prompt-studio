import { Button, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExtensionActionState } from "./extension-action-feedback";

export const ExtensionConflictPopover = ({
  action,
  onResolve,
}: {
  action: ExtensionActionState;
  onResolve?: () => void;
}) => {
  const { t } = useTranslation("projects");
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={({ open }) => setOpen(open)} positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <IconButton
          variant="ghost"
          size="2xs"
          color="fg.error"
          aria-label={t("projectSettings.extensionsPanel.upgrade.conflict", "Upgrade conflict")}
          data-testid="extension-upgrade-conflict"
        >
          <CircleAlert />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="320px">
            <Popover.Body>
              <Stack gap="sm">
                <Text textStyle="label/S/medium">{action.label}</Text>
                <Text textStyle="label/XS" color="fg.muted">
                  {action.error}
                </Text>
                <Button
                  size="sm"
                  alignSelf="start"
                  disabled={!onResolve}
                  onClick={() => {
                    setOpen(false);
                    onResolve?.();
                  }}
                >
                  {t("projectSettings.extensionsPanel.upgrade.resolve", "Resolve")}
                </Button>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
