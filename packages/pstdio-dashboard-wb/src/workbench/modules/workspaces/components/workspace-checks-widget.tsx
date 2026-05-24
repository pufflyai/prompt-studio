import { Box } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";

export const WorkspaceChecksWidget = (_props: { input: WorkbenchWidgetRenderInput }) => (
  <Box flex="1" minH="0" display="flex" alignItems="center" justifyContent="center" px="md" py="lg">
    <EmptyState title="Not Implemented" description="Checks are not yet implemented." />
  </Box>
);
