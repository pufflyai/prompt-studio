import { Heading, Input, InputGroup, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { createGlyphIcon, EmptyState, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import type { ArtifactSummary } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { ArtifactThumbnail, type LoadArtifactPreview } from "./artifact-thumbnail";

const SearchIcon = createGlyphIcon("search-normal-1");
interface ArtifactLibraryProps {
  items: ArtifactSummary[];
  onOpen: (item: ArtifactSummary) => void;
  loadPreview: LoadArtifactPreview;
}

const editedDate = (value: string, { t, locale }: ReturnType<typeof useArtifactTranslations>) => {
  const date = new Date(value);
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3_600_000));
  if (hours === 0) return t("library.editedNow", "Edited just now");
  if (hours < 24)
    return t("library.editedAt", "Edited {{date}}", {
      date: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-hours, "hour"),
    });
  if (hours < 48) return t("library.editedYesterday", "Edited yesterday");
  return t("library.editedAt", "Edited {{date}}", {
    date: date.toLocaleDateString(locale, { month: "short", day: "numeric" }),
  });
};

export const ArtifactLibrary = (props: ArtifactLibraryProps) => {
  const { items, onOpen, loadPreview } = props;
  const translations = useArtifactTranslations();
  const { t } = translations;
  const [search, setSearch] = useState("");
  const filtered = items.filter((item) => item.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <Stack overflowY="auto" height="full">
      <Stack gap="lg" p="lg" width="full" maxWidth="4xl" mx="auto">
        <Heading textStyle="heading/M/bold">{t("library.heading", "Artifacts")}</Heading>
        <InputGroup startElement={<SearchIcon />} width="full">
          <Input
            type="search"
            aria-label={t("library.search", "Search artifacts")}
            placeholder={t("library.searchPlaceholder", "Search artifacts…")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
        {filtered.length ? (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="lg">
            {filtered.map((item) => (
              <SimpleCard
                asChild
                key={item.artifactId}
                overflow="hidden"
                textAlign="left"
                cursor="pointer"
                focusVisibleRing="outside"
                _hover={{ borderColor: "border" }}
              >
                <button type="button" aria-label={item.title} onClick={() => onOpen(item)}>
                  <ArtifactThumbnail item={item} loadPreview={loadPreview} />
                  <SimpleCardBody>
                    <Stack gap="xs">
                      <Text textStyle="paragraph/S/medium" truncate>
                        {item.title}
                      </Text>
                      <Text textStyle="paragraph/XS/regular" color="fg.muted">
                        {editedDate(item.publishedAt, translations)}
                      </Text>
                    </Stack>
                  </SimpleCardBody>
                </button>
              </SimpleCard>
            ))}
          </SimpleGrid>
        ) : (
          <EmptyState
            title={
              search
                ? t("library.noMatches", "No matching artifacts")
                : t("library.emptyTitle", "Your first artifact starts with an idea")
            }
            description={
              search
                ? t("library.searchHint", "Try a different title.")
                : t("library.emptyHint", "Ask an agent to create and publish an interactive HTML page.")
            }
          />
        )}
      </Stack>
    </Stack>
  );
};
