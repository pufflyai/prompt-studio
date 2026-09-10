import { Box, Button, HStack, Menu, Stack, Text } from "@chakra-ui/react";
import { createGlyphIcon } from "@pstdio/ui";
import { useState } from "react";
import type { ArtifactContent, ArtifactSummary } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { DeleteArtifactDialog } from "./delete-artifact-dialog";
import { HtmlPreview } from "./html-preview";
import { RenameArtifactDialog } from "./rename-artifact-dialog";

const ChevronDown = createGlyphIcon("arrow-down-1");
interface ArtifactReaderProps {
  content: ArtifactContent;
  revisions: ArtifactSummary[];
  onSelect: (revisionId: string) => void;
  onBack: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const ArtifactReader = (props: ArtifactReaderProps) => {
  const { content, revisions, onSelect, onBack, onRename, onDelete } = props;
  const { t } = useArtifactTranslations();
  const [dialog, setDialog] = useState<"rename" | "delete">();
  const latest = revisions[0];
  const title = latest?.title ?? content.title;
  return (
    <Stack height="full" gap="0" minHeight="0">
      <HStack p="sm" borderBottomWidth="1px" borderColor="border.subtle">
        <Menu.Root positioning={{ placement: "bottom-start" }}>
          <Menu.Trigger asChild>
            <Button
              variant="ghost"
              aria-label={t("reader.actions", "{{title}} — versions and actions", { title })}
              maxWidth="full"
            >
              <Text truncate textStyle="paragraph/S/medium">
                {title}
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
              <Menu.Separator />
              <Menu.Item value="rename" onClick={() => setDialog("rename")}>
                {t("reader.rename", "Rename artifact…")}
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item value="library" onClick={onBack}>
                {t("reader.all", "All artifacts")}
              </Menu.Item>
              <Menu.Item value="delete" onClick={() => setDialog("delete")}>
                {t("reader.delete", "Delete artifact…")}
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </HStack>
      <Box flex="1" minHeight="0" width="full" bg="bg.muted" overflow="hidden">
        <HtmlPreview
          key={content.id}
          title={t("reader.preview", "Preview: {{title}}", { title })}
          html={content.html}
        />
      </Box>
      {dialog === "rename" ? (
        <RenameArtifactDialog name={title} onRename={onRename} onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog === "delete" ? (
        <DeleteArtifactDialog title={title} onDelete={onDelete} onClose={() => setDialog(undefined)} />
      ) : null}
    </Stack>
  );
};
