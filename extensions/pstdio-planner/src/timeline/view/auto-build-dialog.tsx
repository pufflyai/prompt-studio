import { Button, CloseButton, Dialog, Link, Portal, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import { psTheme } from "@pstdio/ui/theme";
import { AutoBuildFilterBubbles } from "./auto-build-filter-bubbles";

interface AutoBuildDialogProps {
  filter: ViewFilterGroup;
  fields: AttributeDescriptor[];
  saving: boolean;
  error?: string;
  onEnable: () => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildDialog(props: AutoBuildDialogProps) {
  const { filter, fields, saving, error, onEnable, onClose, t } = props;
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const save = async () => {
    if (await onEnable()) onClose();
  };
  return (
    <Dialog.Root open size="md" onOpenChange={({ open }) => !open && !saving && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("timeline.autoBuild.start", "Auto Build")}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" disabled={saving} />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="md">
                <Dialog.Description>
                  {t(
                    "timeline.autoBuild.description",
                    "Implement all Todo tickets matching these filters with your default agent. While Auto Build is on, ready work is automatically assigned as capacity becomes available.",
                  )}
                </Dialog.Description>
                <AutoBuildFilterBubbles itemLabel="Ticket" filter={filter} fields={fields} />
                <Link
                  variant="underline"
                  href="https://prompt.studio/docs/extensions/planner/auto-build/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("timeline.autoBuild.documentation", "Auto Build documentation")}
                </Link>
                {error ? (
                  <Text role="alert" color="fg.error">
                    {error}
                  </Text>
                ) : null}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>
                {t("timeline.autoBuild.cancel", "Cancel")}
              </Button>
              <Button
                size="sm"
                css={button({ variant: "primary", size: "sm" })}
                onClick={() => void save()}
                loading={saving}
                disabled={saving}
              >
                {t("timeline.autoBuild.start", "Auto Build")}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
