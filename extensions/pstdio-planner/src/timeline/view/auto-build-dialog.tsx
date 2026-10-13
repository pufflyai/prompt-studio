import { Button, CloseButton, Dialog, Icon, Link, Portal, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { Checkbox } from "@pstdio/ui";
import { buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { psTheme } from "@pstdio/ui/theme";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { CollectionFilter } from "../../../vendor/collection-filter.js";
import type { PlannerStatus } from "../../public-command-refs";
import { StatusChoices } from "../../views/status-choices";
import type { timelineQueryData } from "./timeline-query";

interface AutoBuildDialogProps {
  prompt: string;
  ignore: ViewFilterGroup;
  requireMergedDependencies: boolean;
  eligibleStatusIds: string[];
  statuses: PlannerStatus[];
  data: ReturnType<typeof timelineQueryData>;
  saving: boolean;
  error?: string;
  onEnable: (
    prompt: string,
    ignore: ViewFilterGroup,
    requireMergedDependencies: boolean,
    eligibleStatusIds: string[],
  ) => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildDialog(props: AutoBuildDialogProps) {
  const {
    prompt: initialPrompt,
    ignore: initialIgnore,
    requireMergedDependencies: initialRequireMerged,
    eligibleStatusIds: initialEligible,
    statuses,
    data,
    saving,
    error,
    onEnable,
    onClose,
    t,
  } = props;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [ignore, setIgnore] = useState(initialIgnore);
  const [requireMergedDependencies, setRequireMerged] = useState(initialRequireMerged);
  const [eligibleStatusIds, setEligible] = useState(initialEligible);
  const missing = eligibleStatusIds.some((id) => !statuses.some((status) => status.id === id));
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const categories = buildFilterCategories(data.attributes, data.rows);
  const save = async () => {
    if (await onEnable(prompt, ignore, requireMergedDependencies, eligibleStatusIds)) onClose();
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
                <Stack gap="xs">
                  <Dialog.Description>
                    {t(
                      "timeline.autoBuild.description",
                      "A supervisor uses your prompt to assign valid, unassigned tickets as capacity becomes available. It sleeps between checks and resumes when more work can run.",
                    )}
                  </Dialog.Description>
                  <Link
                    variant="underline"
                    alignSelf="start"
                    href="https://prompt.studio/docs/extensions/planner/auto-build/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("timeline.autoBuild.documentation", "Auto Build documentation")}
                    <Icon as={ArrowUpRight} boxSize="icon-xs" />
                  </Link>
                </Stack>
                <StatusChoices
                  id="eligible-statuses"
                  label="Eligible statuses"
                  description="Choose the statuses Auto Build can use for new work. Assigned work can continue after its status changes."
                  statuses={statuses}
                  value={eligibleStatusIds}
                  multiple
                  disabled={saving}
                  onChange={(value) => setEligible(value as string[])}
                />
                {!eligibleStatusIds.length || missing ? (
                  <Text role="alert" color="fg.error">
                    {missing
                      ? "Remove or replace missing eligible statuses."
                      : "Choose at least one eligible status to start."}
                  </Text>
                ) : null}
                <LazyMarkdownEditor
                  autoFocus
                  defaultState={prompt}
                  isEditable={!saving}
                  placeholder={t(
                    "timeline.autoBuild.prompt",
                    "Describe how the supervisor should choose and assign work…",
                  )}
                  onChange={setPrompt}
                />
                <Stack gap="xs">
                  <Text textStyle="label/S/medium">
                    {t("timeline.autoBuild.ignore", "Ignore tickets matching these filters")}
                  </Text>
                  <CollectionFilter
                    filter={ignore}
                    onFilterChange={setIgnore}
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
                disabled={saving || !prompt.trim() || !eligibleStatusIds.length || missing}
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
