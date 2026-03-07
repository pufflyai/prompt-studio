import { Box, Flex, Spinner, Stack } from "@chakra-ui/react";
import { DocsChangelog, EmptyState } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { useChangelog } from "../hooks/use-changelog";

export const ChangelogPanel = () => {
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
        title="Unable to load changelog"
        description={error instanceof Error ? error.message : "Try again."}
      />
    );
  }

  if (!changelog || changelog.entries.length === 0) {
    return <EmptyState title="No changelog entries" description="Add entries to .pstdio/changelog/changelog.md" />;
  }

  return (
    <Stack height="100%" flex="1" overflow="auto">
      <Box py="16" px={{ base: "6", md: "10" }} maxW="4xl" mx="auto" width="100%">
        <DocsChangelog title={changelog.title} description={changelog.description} entries={changelog.entries} />
      </Box>
    </Stack>
  );
};
