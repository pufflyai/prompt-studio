import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import { ShieldCheck } from "lucide-react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { findDashboardWorkspace, getDashboardDataVersion, subscribeDashboardData } from "../../../data/dashboard-data";
import { getDashboardSelectedProjectId } from "../../../shared/project-context";

const checkStatusColors = {
  failed: "red",
  passed: "green",
  saved: "gray",
} as const;

export const WorkspaceChecksWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);

  const workspace = input.placement.resource
    ? findDashboardWorkspace(input.placement.resource, getDashboardSelectedProjectId(input.workbench))
    : undefined;
  const checks = workspace?.review.checks ?? [];

  if (checks.length === 0) {
    return (
      <Box flex="1" minH="0" display="flex" alignItems="center" justifyContent="center" px="md" py="lg">
        <EmptyState title="No checks yet" description="Validation artifacts will appear here after they are saved." />
      </Box>
    );
  }

  return (
    <ScrollArea flex="1" minH="0" contentProps={{ p: "sm", spaceY: "xs" }}>
      {checks.map((check) => (
        <HStack key={check.id} gap="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted">
          <ShieldCheck size={15} />
          <Text textStyle="label/S/regular" flex="1">
            {check.label}
          </Text>
          <Badge colorPalette={checkStatusColors[check.status]} variant="subtle">
            {check.status}
          </Badge>
        </HStack>
      ))}
    </ScrollArea>
  );
};
