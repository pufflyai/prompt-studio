import { Button, Popover, Stack, Text, useRecipe, useSlotRecipe } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { Checkbox } from "@pstdio/ui";
import { CollectionFilter } from "@pstdio/ui/collection-view";
import { buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { psTheme } from "@pstdio/ui/theme";
import { useState } from "react";
import type { timelineQueryData } from "./timeline-query";

export interface AutoBuildFormProps {
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

export function AutoBuildForm(props: AutoBuildFormProps) {
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
  const panel = useSlotRecipe({ recipe: psTheme.getSlotRecipe("popover") })({ variant: "panel" });
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
    <>
      <Popover.Header css={panel.header}>
        <Popover.Title css={panel.title}>{t("timeline.autoBuild.start", "Auto Build")}</Popover.Title>
      </Popover.Header>
      <Popover.Body css={panel.body}>
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
      </Popover.Body>
      <Popover.Footer css={panel.footer} display="flex" justifyContent="flex-end" gap="xs">
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
      </Popover.Footer>
    </>
  );
}
