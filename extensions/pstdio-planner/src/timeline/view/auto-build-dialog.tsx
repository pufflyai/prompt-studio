import { Button, CloseButton, Dialog, Icon, Link, Portal, Stack, Text, useRecipe } from "@chakra-ui/react";
import { NumberInput } from "@pstdio/ui/param-editor";
import { psTheme } from "@pstdio/ui/theme";
import { Link as LinkIcon } from "lucide-react";
import { useState } from "react";

interface AutoBuildDialogProps {
  maxInProgress: number;
  saving: boolean;
  error?: string;
  onEnable: (maxInProgress: number) => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildDialog(props: AutoBuildDialogProps) {
  const { maxInProgress, saving, error, onEnable, onClose, t } = props;
  const [limit, setLimit] = useState(maxInProgress);
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const save = async () => {
    if (await onEnable(limit)) onClose();
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
                <Stack gap="xs">
                  <Dialog.Description>
                    {t(
                      "timeline.autoBuild.description",
                      "While Auto Build is on, valid tasks are automatically assigned to your default agent as capacity becomes available.",
                    )}
                  </Dialog.Description>
                  <Link
                    variant="underline"
                    alignSelf="start"
                    href="https://prompt.studio/docs/extensions/planner/auto-build/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon as={LinkIcon} boxSize="icon-sm" />
                    {t("timeline.autoBuild.documentation", "Auto Build documentation")}
                  </Link>
                </Stack>
                <NumberInput
                  id="auto-build-max-parallel"
                  name={t("timeline.autoBuild.maxParallel", "Maximum parallel tasks")}
                  defaultValue={limit}
                  min={0}
                  step={1}
                  description=""
                  hideSlider
                  readOnly={saving}
                  onChange={(_id, value) => setLimit(value)}
                />
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
