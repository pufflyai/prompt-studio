import { Button, Dialog, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { ExtensionHarnessInput, GuestHost, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { Checkbox, ScrollArea } from "@pstdio/ui";
import { CollectionFilter } from "@pstdio/ui/collection-view";
import { buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { psTheme } from "@pstdio/ui/theme";
import { useState } from "react";
import { SupervisorModelField } from "./supervisor-model-field";
import type { timelineQueryData } from "./timeline-query";

export interface AutoBuildFormProps {
  prompt: string;
  eligible: ViewFilterGroup;
  supervisorModel?: ExtensionHarnessInput;
  host: GuestHost;
  requireMergedDependencies: boolean;
  data: ReturnType<typeof timelineQueryData>;
  saving: boolean;
  error?: string;
  onEnable: (
    prompt: string,
    requireMergedDependencies: boolean,
    eligible: ViewFilterGroup,
    supervisorModel?: ExtensionHarnessInput,
  ) => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildForm(props: AutoBuildFormProps) {
  const {
    prompt: initialPrompt,
    eligible: initialEligible,
    supervisorModel: initialModel,
    host,
    requireMergedDependencies: initialRequireMerged,
    data,
    saving,
    error,
    onEnable,
    onClose,
    t,
  } = props;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [supervisorModel, setSupervisorModel] = useState(initialModel);
  const [eligible, setEligible] = useState(initialEligible);
  const [requireMergedDependencies, setRequireMerged] = useState(initialRequireMerged);
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const categories = buildFilterCategories(data.attributes, data.rows);
  const eligibleLabel = t("timeline.autoBuild.eligible", "Eligible tickets");
  const save = async () => {
    if (await onEnable(prompt, requireMergedDependencies, eligible, supervisorModel)) onClose();
  };
  return (
    <>
      <Dialog.Body flex="1" minH="0" p="0">
        <ScrollArea h="full" contentProps={{ py: "md" }}>
          <Stack gap="md">
            <Stack px="lg">
              <LazyMarkdownEditor
                autoFocus
                defaultState={prompt}
                isEditable={!saving}
                placeholder={t("timeline.autoBuild.prompt", "Describe the work to build…")}
                onChange={setPrompt}
              />
            </Stack>
            <Stack gap="0" px="sm">
              <SupervisorModelField
                host={host}
                value={supervisorModel}
                onChange={setSupervisorModel}
                disabled={saving}
                label={t("timeline.autoBuild.supervisorModel", "Supervisor model")}
              />
            </Stack>
            <Stack gap="md" px="lg">
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
