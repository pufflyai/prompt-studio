import { Skeleton, SkeletonText, Stack } from "@chakra-ui/react";

export const MarkdownEditorSkeleton = () => (
  <Stack w="full" minW="0" gap="lg" layerStyle="markdownEditorInset" role="status" aria-label="Loading document">
    <Skeleton aria-hidden="true" variant="none" height="6" width="2/5" borderRadius="xs" />
    <SkeletonText aria-hidden="true" variant="none" noOfLines={4} gap="sm" />
    <SkeletonText aria-hidden="true" variant="none" noOfLines={3} gap="sm" />
  </Stack>
);
