import { Button, HStack, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import type { ExtensionAuthor } from "@pstdio/sdk/api";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExtensionFilterMenu } from "./extension-filter-menu";
import {
  defaultExtensionFilters,
  type ExtensionFilters,
  matchesExtensionAuthor,
  matchesExtensionScope,
  matchesExtensionSearch,
} from "./extension-filters";

type FilterableExtension = {
  author?: ExtensionAuthor;
  scope?: "repo" | "global";
  displayName: string;
  extensionId?: string;
  description?: string;
};
interface ExtensionsPanelHeaderProps {
  extensions: FilterableExtension[];
  filters: ExtensionFilters;
  onFiltersChange: (filters: ExtensionFilters) => void;
  upgrade: ReactNode;
}

export const ExtensionsPanelHeader = ({
  extensions,
  filters,
  onFiltersChange,
  upgrade,
}: ExtensionsPanelHeaderProps) => {
  const { t } = useTranslation("projects");
  const key = "projectSettings.extensionsPanel";
  const searched = extensions.filter((extension) => matchesExtensionSearch(extension, filters.search));
  const scoped = searched.filter((extension) => matchesExtensionScope(extension, filters.scope));
  const authored = searched.filter((extension) => matchesExtensionAuthor(extension, filters.author));
  const publishers = [
    ...new Set(
      extensions.flatMap((extension) => (extension.author?.kind === "publisher" ? [extension.author.publisher] : [])),
    ),
  ]
    .filter((publisher) => publisher !== "pstdio")
    .sort();
  const authors = [
    { value: "all", label: t(`${key}.author.all`) },
    { value: "me", label: t(`${key}.author.me`) },
    { value: "publisher:pstdio", label: t(`${key}.author.promptStudio`) },
    ...publishers.map((publisher) => ({ value: `publisher:${publisher}`, label: publisher })),
  ];
  const filtered = filters.search.trim() || filters.author !== "all" || filters.scope !== "all";
  return (
    <Stack bg="bg" gap="0">
      <Stack padding="lg" gap="md" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack justify="space-between" gap="md" flexWrap="wrap">
          <Text textStyle="heading/M" flex="1">
            {t(`${key}.title`)}
          </Text>
          {upgrade}
          <InputGroup startElement={<Icon as={Search} boxSize="3.5" />} w={{ base: "full", sm: "64" }}>
            <Input
              size="sm"
              value={filters.search}
              placeholder={t(`${key}.searchPlaceholder`)}
              aria-label={t(`${key}.searchPlaceholder`)}
              data-testid="extensions-search"
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />
          </InputGroup>
        </HStack>
        <HStack gap="sm" flexWrap="wrap">
          <ExtensionFilterMenu
            label={t(`${key}.author.label`)}
            value={filters.author}
            options={authors.map((author) => ({
              ...author,
              count: scoped.filter((extension) => matchesExtensionAuthor(extension, author.value)).length,
            }))}
            onChange={(author) => onFiltersChange({ ...filters, author })}
          />
          <ExtensionFilterMenu
            label={t(`${key}.scope.label`)}
            value={filters.scope}
            options={(["all", "repo", "global"] as const).map((scope) => ({
              value: scope,
              label: t(`${key}.scope.${scope}`),
              count: authored.filter((extension) => matchesExtensionScope(extension, scope)).length,
            }))}
            onChange={(scope) => onFiltersChange({ ...filters, scope: scope as ExtensionFilters["scope"] })}
          />
          {filtered && (
            <Button variant="ghost" size="xs" onClick={() => onFiltersChange(defaultExtensionFilters)}>
              {t(`${key}.clearFilters`)}
            </Button>
          )}
        </HStack>
      </Stack>
      <HStack
        paddingX="lg"
        paddingY="sm"
        gap="md"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        color="fg.subtle"
      >
        <Text textStyle="label/XS/medium" flex="1">
          {t(`${key}.columns.extension`)}
        </Text>
        <HStack display={{ base: "none", md: "flex" }} gap="md">
          <Text textStyle="label/XS/medium" w="28">
            {t(`${key}.author.label`)}
          </Text>
          <Text textStyle="label/XS/medium" w="28">
            {t(`${key}.scope.label`)}
          </Text>
          <Text textStyle="label/XS/medium" w="16" textAlign="end">
            {t(`${key}.columns.enabled`)}
          </Text>
        </HStack>
      </HStack>
    </Stack>
  );
};
