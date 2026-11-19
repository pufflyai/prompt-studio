import { Box, Button, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import { createGlyphIcon, Header, ScopedMenu as Menu, Portal, ScrollArea } from "@pstdio/ui";
import { type UIEvent, useState } from "react";
import type { ArtifactContent, ArtifactSummary } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { HtmlPreview } from "./html-preview";

const ChevronDown = createGlyphIcon("arrow-down-1");
const History = createGlyphIcon("history");
const Check = createGlyphIcon("check");
const VERSION_PAGE_SIZE = 100;
interface ArtifactReaderProps {
  content?: ArtifactContent;
  readError?: string;
  selectedId?: string;
  revisions: ArtifactSummary[];
  onSelect: (revisionId: string) => void;
}

export const ArtifactReader = (props: ArtifactReaderProps) => {
  const { content, readError, selectedId = content?.id, revisions, onSelect } = props;
  const { t, locale } = useArtifactTranslations();
  const [versionLimit, setVersionLimit] = useState(VERSION_PAGE_SIZE);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const latest = revisions[0];
  const title = latest?.title ?? content?.title ?? "";
  const selectedIndex = revisions.findIndex((revision) => revision.id === selectedId);
  const selected = revisions[selectedIndex];
  const selectedLabel =
    selected?.label?.trim() || t("reader.version", "Version {{number}}", { number: revisions.length - selectedIndex });
  const visibleRevisions = revisions.slice(0, versionLimit).map((revision, index) => ({ revision, index }));
  if (selected && selectedIndex >= versionLimit) visibleRevisions.unshift({ revision: selected, index: selectedIndex });
  const loadMoreVersions = (event: UIEvent<HTMLElement>) => {
    const { scrollHeight, clientHeight, scrollTop } = event.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 2)
      setVersionLimit((limit) => Math.min(limit + VERSION_PAGE_SIZE, revisions.length));
  };
  let preview = (
    <Center height="full">
      <Spinner />
    </Center>
  );
  if (readError) {
    preview = (
      <Center height="full">
        <Text role="alert" color="fg.muted" title={readError}>
          {t("reader.unavailable", "Artifacts unavailable")}
        </Text>
      </Center>
    );
  } else if (content) {
    preview = (
      <HtmlPreview key={content.id} title={t("reader.preview", "Preview: {{title}}", { title })} html={content.html} />
    );
  }
  return (
    <Stack height="full" gap="0" minHeight="0" minWidth="0">
      <Header flexShrink="0" minWidth="0" justifyContent="flex-end">
        <Menu.Root
          lazyMount
          unmountOnExit
          positioning={{ placement: "bottom-end" }}
          onOpenChange={({ open }) => {
            if (!open) setVersionLimit(VERSION_PAGE_SIZE);
          }}
        >
          <Menu.Trigger asChild>
            <Button
              variant="outline"
              aria-label={t("reader.versions", "Versions")}
              minWidth="0"
              maxWidth="64"
              flexShrink="1"
            >
              <History />
              <Text truncate textStyle="paragraph/S/medium">
                {selectedLabel}
              </Text>
              <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content
                width="64"
                minWidth="0"
                maxWidth="var(--available-width)"
                maxHeight="min(var(--available-height), var(--chakra-sizes-xs))"
              >
                <ScrollArea
                  flex="1"
                  minHeight="0"
                  viewportProps={{ overscrollBehavior: "contain", tabIndex: -1, onScroll: loadMoreVersions }}
                >
                  <Menu.RadioItemGroup
                    aria-label={t("reader.versions", "Versions")}
                    value={selectedId}
                    onValueChange={(event) => onSelect(event.value)}
                  >
                    {visibleRevisions.map(({ revision, index }) => (
                      <Menu.RadioItem key={revision.id} value={revision.id}>
                        <Stack flex="1" minWidth="0" gap="0">
                          <Menu.ItemText truncate>
                            {revision.label?.trim() ||
                              t("reader.version", "Version {{number}}", { number: revisions.length - index })}
                            {revision.id === latest?.id ? t("reader.latest", " · Latest") : ""}
                          </Menu.ItemText>
                          <Text asChild textStyle="label/S/regular" color="fg.muted">
                            <time dateTime={revision.publishedAt}>{date.format(new Date(revision.publishedAt))}</time>
                          </Text>
                        </Stack>
                        <Menu.ItemIndicator>
                          <Check />
                        </Menu.ItemIndicator>
                      </Menu.RadioItem>
                    ))}
                  </Menu.RadioItemGroup>
                </ScrollArea>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </Header>
      <Box flex="1" minHeight="0" width="full" bg="bg.muted" overflow="hidden">
        {preview}
      </Box>
    </Stack>
  );
};
