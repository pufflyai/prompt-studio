import { Button, CloseButton, Dialog, Portal, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { Checkbox } from "@pstdio/ui";
import { buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { psTheme } from "@pstdio/ui/theme";
import { useState } from "react";
import { CollectionFilter } from "../../../vendor/collection-filter.js";
import type { timelineQueryData } from "./timeline-query";

interface AutoBuildDialogProps {
  prompt: string;
  eligible: ViewFilterGroup;
  ignore: ViewFilterGroup;
  requireMergedDependencies: boolean;
  data: ReturnType<typeof timelineQueryData>;
  saving: boolean;
  error?: string;
  onEnable: (
    prompt: string,
    ignore: ViewFilterGroup,
    requireMergedDependencies: boolean,
    eligible: ViewFilterGroup,
  ) => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildDialog(props: AutoBuildDialogProps) {
  const {
    prompt: initialPrompt,
    eligible: initialEligible,
    ignore: initialIgnore,
    requireMergedDependencies: initialRequireMerged,
    data,
    saving,
    error,
    onEnable,
    onClose,
    t,
  } = props;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [eligible, setEligible] = useState(initialEligible);
  const [ignore, setIgnore] = useState(initialIgnore);
  const [requireMergedDependencies, setRequireMerged] = useState(initialRequireMerged);
  const categories = buildFilterCategories(data.attributes, data.rows);
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const filters = [
    {
      id: "eligible",
      label: t("timeline.autoBuild.eligible", "Eligible tickets"),
      value: eligible,
      change: setEligible,
    },
    { id: "ignore", label: t("timeline.autoBuild.ignore", "Ignore tickets"), value: ignore, change: setIgnore },
  ];
  const save = async () => {
    if (await onEnable(prompt, ignore, requireMergedDependencies, eligible)) onClose();
  };
  return (
    <Dialog.Root
      open
      size="lg"
      scrollBehavior="inside"
      closeOnInteractOutside={false}
      onOpenChange={({ open }) => !open && !saving && onClose()}
    >
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
                <LazyMarkdownEditor
                  autoFocus
                  defaultState={prompt}
                  isEditable={!saving}
                  placeholder={t("timeline.autoBuild.prompt", "Describe the work to build…")}
                  onChange={setPrompt}
                />
                {filters.map(({ id, label, value, change }) => (
                  <Stack key={id} gap="xs" role="group" aria-label={label}>
                    <Text textStyle="label/S/medium">{label}</Text>
                    <CollectionFilter
                      filter={value}
                      onFilterChange={(filter) => !saving && change(filter)}
                      itemLabel="Ticket"
                      fields={data.attributes}
                      optionsFor={(field) => categories.find(({ id }) => id === field.id)?.options ?? []}
                    />
                  </Stack>
                ))}
                <Checkbox
                  size="sm"
                  checked={requireMergedDependencies}
                  disabled={saving}
                  onCheckedChange={({ checked }) => setRequireMerged(checked === true)}
                >
                  {t("timeline.autoBuild.requireMerged", "Require merged dependencies")}
                </Checkbox>
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
                disabled={saving || !prompt.trim()}
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
