import { Box, Flex, Spinner, Stack } from "@chakra-ui/react";
import { DocsChangelog, EmptyState } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OpenSidebarButton } from "@/features/project/components/open-sidebar-button";
import { useChangelog } from "../hooks/use-changelog";

export const ChangelogPanel = () => {
  const { t } = useTranslation();
  const { projectId } = useParams({ strict: false });
  const resolvedProjectId = typeof projectId === "string" ? projectId : undefined;
  const { data: changelog, isLoading, error } = useChangelog(resolvedProjectId);

  if (isLoading) {
    return (
      <Flex height="100%" align="center" justify="center">
        <Spinner />
      </Flex>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={t("changelog.unableToLoad")}
        description={error instanceof Error ? error.message : "Try again."}
      />
    );
  }

  if (!changelog || changelog.entries.length === 0) {
    return <EmptyState title={t("changelog.noEntries")} description={t("changelog.addEntries")} />;
  }

  return (
    <Stack height="100%" flex="1" overflow="auto" position="relative">
      <OpenSidebarButton />
      <Box py="16" px={{ base: "6", md: "10" }} maxW="4xl" mx="auto" width="100%">
        <DocsChangelog title={changelog.title} description={changelog.description} entries={changelog.entries} />
      </Box>
    </Stack>
  );
};
