import { Box, Button, Menu, Stack, Text } from "@chakra-ui/react";
import { createGlyphIcon, Header } from "@pstdio/ui";
import type { ArtifactContent, ArtifactSummary } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { HtmlPreview } from "./html-preview";

const ChevronDown = createGlyphIcon("arrow-down-1");
const History = createGlyphIcon("history");
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
    <Stack height="full" gap="0" minHeight="0">
      <Header flexShrink="0" justifyContent="space-between">
        <Menu.Root positioning={{ placement: "bottom-start" }}>
          <Menu.Trigger asChild>
            <Button
              variant="ghost"
              aria-label={t("reader.versions", "Versions")}
              minWidth="0"
              flexShrink="1"
              maxWidth="full"
            >
              <History />
              <Text truncate textStyle="paragraph/S/medium">
                {selectedLabel}
              </Text>
              <ChevronDown />
            </Button>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content maxHeight="xl" overflowY="auto">
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>{t("reader.versions", "Versions")}</Menu.ItemGroupLabel>
                <Menu.RadioItemGroup value={content.id} onValueChange={(event) => onSelect(event.value)}>
                  {revisions.map((revision, index) => (
                    <Menu.RadioItem key={revision.id} value={revision.id}>
                      <History />
                      <Menu.ItemText>
                        {revision.label ||
                          t("reader.version", "Version {{number}}", { number: revisions.length - index })}
                        {revision.id === latest?.id ? t("reader.latest", " · Latest") : ""}
                      </Menu.ItemText>
                      <Menu.ItemIndicator />
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioItemGroup>
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
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
