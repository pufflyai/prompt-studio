import { Button, Dialog, HStack, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { ExtensionHarnessInput, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { Checkbox, ScrollArea } from "@pstdio/ui";
import { CollectionFilter } from "@pstdio/ui/collection-view";
import { buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { psTheme } from "@pstdio/ui/theme";
import { ChevronDown, Cpu } from "lucide-react";
import { useState } from "react";
import type { timelineQueryData } from "./timeline-query";

export interface AutoBuildFormProps {
  prompt: string;
  eligible: ViewFilterGroup;
  supervisorModel?: ExtensionHarnessInput;
  onSelectModel: () => void;
  requireMergedDependencies: boolean;
  data: ReturnType<typeof timelineQueryData>;
  saving: boolean;
  error?: string;
  onEnable: (prompt: string, requireMergedDependencies: boolean, eligible: ViewFilterGroup) => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildForm(props: AutoBuildFormProps) {
  const {
    prompt: initialPrompt,
    eligible: initialEligible,
    supervisorModel,
    onSelectModel,
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
  const [requireMergedDependencies, setRequireMerged] = useState(initialRequireMerged);
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const categories = buildFilterCategories(data.attributes, data.rows);
  const eligibleLabel = t("timeline.autoBuild.eligible", "Eligible tickets");
  const save = async () => {
    if (await onEnable(prompt, requireMergedDependencies, eligible)) onClose();
  };
  return (
    <>
      <Dialog.Body flex="1" minH="0" p="0">
        <ScrollArea h="full" contentProps={{ px: "lg", py: "md" }}>
          <Stack gap="md">
            <HStack justifyContent="space-between" gap="md">
              <Text textStyle="label/S/medium">{t("timeline.autoBuild.supervisorModel", "Supervisor model")}</Text>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={onSelectModel}
                aria-label={t("timeline.autoBuild.supervisorModel", "Supervisor model")}
              >
                <Cpu />
                {supervisorModel?.model ??
                  supervisorModel?.harnessId.split(".").at(-1) ??
                  t("timeline.autoBuild.defaultModel", "Project default")}
                <ChevronDown />
              </Button>
            </HStack>
            <LazyMarkdownEditor
              autoFocus
              defaultState={prompt}
              isEditable={!saving}
              placeholder={t("timeline.autoBuild.prompt", "Describe the work to build…")}
              onChange={setPrompt}
            />
            <Stack gap="xs" role="group" aria-label={eligibleLabel}>
              <Text textStyle="label/S/medium">{eligibleLabel}</Text>
              <CollectionFilter
                filter={eligible}
                onFilterChange={(filter) => !saving && setEligible(filter)}
                itemLabel="Ticket"
                fields={data.attributes}
                optionsFor={(field) => categories.find(({ id }) => id === field.id)?.options ?? []}
              />
            </Stack>
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
        </ScrollArea>
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
    </>
  );
}
