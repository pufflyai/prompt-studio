import { Button, CloseButton, Dialog, Icon, Link, Portal, Stack, Text, useRecipe } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { CollectionViewBar, useCollectionViewStore } from "@pstdio/ui/collection-view";
import { buildFilterCategories } from "@pstdio/ui/kanban-renderer";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { psTheme } from "@pstdio/ui/theme";
import { ArrowUpRight } from "lucide-react";
import { useId, useState } from "react";
import type { timelineQueryData } from "./timeline-query";

interface AutoBuildDialogProps {
  prompt: string;
  ignore: ViewFilterGroup;
  data: ReturnType<typeof timelineQueryData>;
  saving: boolean;
  error?: string;
  onEnable: (prompt: string, ignore: ViewFilterGroup) => Promise<boolean>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export function AutoBuildDialog(props: AutoBuildDialogProps) {
  const { prompt: initialPrompt, ignore: initialIgnore, data, saving, error, onEnable, onClose, t } = props;
  const [prompt, setPrompt] = useState(initialPrompt);
  const storageKey = `auto-build-ignore:${useId()}`;
  const initialState = { settings: {}, filter: initialIgnore };
  const ignore = useCollectionViewStore(storageKey, initialState, (state) => state.filter);
  const setIgnore = useCollectionViewStore(storageKey, initialState, (state) => state.setFilter);
  const titleRule = ignore.rules.find((rule) => rule.attributeId === "title" && rule.condition === "contains");
  const search = typeof titleRule?.value === "string" ? titleRule.value : "";
  const setSearch = (value: string) =>
    setIgnore({
      ...ignore,
      rules: [
        ...ignore.rules.filter((rule) => rule !== titleRule),
        ...(value ? [{ attributeId: "title", condition: "contains" as const, value }] : []),
      ],
    });
  const button = useRecipe({ recipe: psTheme.getRecipe("button") });
  const categories = buildFilterCategories(data.attributes, data.rows);
  const save = async () => {
    if (await onEnable(prompt, ignore)) onClose();
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
                  <CollectionViewBar
                    storageKey={storageKey}
                    initialState={initialState}
                    itemLabel="Ticket"
                    views={[]}
                    fields={data.attributes}
                    optionsFor={(field) => categories.find(({ id }) => id === field.id)?.options ?? []}
                    search={search}
                    onSearchChange={setSearch}
                    displayControl={null}
                    align="end"
                  />
                </Stack>
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
