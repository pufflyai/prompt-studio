import { Box, Skeleton, SkeletonText, Stack } from "@chakra-ui/react";

interface MarkdownEditorSkeletonProps {
  fullWidth?: boolean;
  padding?: string;
}

export const MarkdownEditorSkeleton = (props: MarkdownEditorSkeletonProps = {}) => {
  const { fullWidth = false, padding } = props;
  return (
    <Box
      w="full"
      minW="0"
      layerStyle="markdownEditorInset"
      padding={padding}
      role="status"
      aria-label="Loading document"
    >
      <Stack layerStyle="documentContent" maxWidth={fullWidth ? "full" : "document-content"} gap="lg">
        <Skeleton aria-hidden="true" variant="none" height="6" width="2/5" borderRadius="xs" />
        <SkeletonText aria-hidden="true" variant="none" noOfLines={4} gap="sm" />
        <SkeletonText aria-hidden="true" variant="none" noOfLines={3} gap="sm" />
      </Stack>
    </Box>
  );
};
