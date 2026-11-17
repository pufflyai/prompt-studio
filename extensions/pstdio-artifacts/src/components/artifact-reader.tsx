import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { createGlyphIcon, Header, ScopedMenu as Menu, Portal, ScrollArea } from "@pstdio/ui";
import type { ArtifactContent, ArtifactSummary } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { HtmlPreview } from "./html-preview";

const ChevronDown = createGlyphIcon("arrow-down-1");
const History = createGlyphIcon("history");
const Check = createGlyphIcon("check");
interface ArtifactReaderProps {
  content: ArtifactContent;
  revisions: ArtifactSummary[];
  onSelect: (revisionId: string) => void;
}

export const ArtifactReader = (props: ArtifactReaderProps) => {
  const { content, revisions, onSelect } = props;
  const { t } = useArtifactTranslations();
  const latest = revisions[0];
  const title = latest?.title ?? content.title;
  const selectedIndex = revisions.findIndex((revision) => revision.id === content.id);
  const selectedLabel =
    content.label || t("reader.version", "Version {{number}}", { number: revisions.length - selectedIndex });
  return (
    <Stack height="full" gap="0" minHeight="0" minWidth="0">
      <Header flexShrink="0" minWidth="0" justifyContent="flex-end">
        <Menu.Root positioning={{ placement: "bottom-end" }}>
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
                maxHeight="var(--available-height)"
              >
                <ScrollArea
                  flex="1"
                  minHeight="0"
                  maxHeight="xs"
                  viewportProps={{ overscrollBehavior: "contain", tabIndex: -1 }}
                >
                  <Menu.RadioItemGroup
                    aria-label={t("reader.versions", "Versions")}
                    value={content.id}
                    onValueChange={(event) => onSelect(event.value)}
                  >
                    {revisions.map((revision, index) => (
                      <Menu.RadioItem key={revision.id} value={revision.id}>
                        <Menu.ItemText truncate>
                          {revision.label ||
                            t("reader.version", "Version {{number}}", { number: revisions.length - index })}
                          {revision.id === latest?.id ? t("reader.latest", " · Latest") : ""}
                        </Menu.ItemText>
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
        <HtmlPreview
          key={content.id}
          title={t("reader.preview", "Preview: {{title}}", { title })}
          html={content.html}
        />
      </Box>
    </Stack>
  );
};
