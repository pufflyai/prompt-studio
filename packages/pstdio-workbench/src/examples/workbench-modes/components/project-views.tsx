import { Badge, Box, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { projectFeed, projectItems, workbenchModes } from "../mock-data/data";

const statusColors: Record<string, string> = {
  open: "gray",
  "in-progress": "yellow",
  done: "green",
};

const findActiveItem = (input: WorkbenchWidgetRenderInput) => {
  const placement = input.workbench.layout.getLayout().regions.main.widgets[0];
  const itemId = typeof placement?.resource?.metadata?.itemId === "string" ? placement.resource.metadata.itemId : null;
  return projectItems.find((item) => item.id === itemId) ?? projectItems[0];
};

export const ProjectOverview = (props: { input: WorkbenchWidgetRenderInput }) => {
  const item = findActiveItem(props.input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "lg" }}>
      <Stack data-ps175-mode="project" gap="lg" w="full" maxW="3xl">
        <Stack gap="xs">
          <HStack gap="xs">
            <WorkbenchIcon name={workbenchModes.project.icon} size={20} />
            <Text textStyle="label/XS/regular" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em">
              Project mode
            </Text>
          </HStack>
          <Text textStyle="heading/L" color="fg">
            {item.label}
          </Text>
          <HStack gap="xs">
            <Badge variant="subtle" colorPalette={statusColors[item.status]}>
              {item.status}
            </Badge>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {workbenchModes.project.description}
            </Text>
          </HStack>
        </Stack>
        <Box borderWidth="1px" borderColor="border.subtle" borderRadius="md" p="md">
          <Text textStyle="paragraph/M/regular" color="fg">
            {item.body}
          </Text>
        </Box>
        <Grid templateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }} gap="md">
          {[
            { icon: "Activity", label: "Activity", value: "5 events" },
            { icon: "Users", label: "Members", value: "4" },
            { icon: "GitBranch", label: "Branches", value: "12" },
          ].map((metric) => (
            <Box key={metric.label} borderWidth="1px" borderColor="border.subtle" borderRadius="sm" p="sm">
              <HStack gap="xs">
                <WorkbenchIcon name={metric.icon} size={14} color="fg.muted" />
                <Text textStyle="label/XS/regular" color="fg.muted">
                  {metric.label}
                </Text>
              </HStack>
              <Text textStyle="heading/M" color="fg">
                {metric.value}
              </Text>
            </Box>
          ))}
        </Grid>
      </Stack>
    </ScrollArea>
  );
};

export const ProjectFeed = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="xs" w="full">
      <HStack gap="xs">
        <WorkbenchIcon name="Activity" size={14} color="fg.muted" />
        <Text textStyle="label/S/medium" color="fg">
          Recent activity
        </Text>
      </HStack>
      {projectFeed.map((entry) => (
        <HStack key={entry.id} gap="sm" minW="0" py="2xs">
          <WorkbenchIcon name={entry.icon} size={14} color="fg.muted" />
          <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
            {entry.title}
          </Text>
          <Text textStyle="label/XS/regular" color="fg.muted" flexShrink={0}>
            {entry.time}
          </Text>
        </HStack>
      ))}
    </Stack>
  </ScrollArea>
);
