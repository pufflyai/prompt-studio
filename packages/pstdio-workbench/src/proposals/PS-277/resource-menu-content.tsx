import { Stack, Text } from "@chakra-ui/react";
import { Activity, ScrollArea } from "@pstdio/ui";
import { WorkbenchIcon } from "../../react/shared/icon";
import type { MenuId } from "./resource-menu-state";
import { ResourceNavigationTree, type ResourceState, type tickets } from "./resource-navigation-content";

export interface ResourceMenuContentProps {
  ticket: (typeof tickets)[number];
  state: ResourceState;
  update: (change: Partial<ResourceState>) => void;
  menu: MenuId;
  onNavigate?: () => void;
}

export const ResourceMenuContent = (props: ResourceMenuContentProps) => {
  const { menu, ticket, state, update, onNavigate } = props;
  if (menu === "resources")
    return <ResourceNavigationTree ticket={ticket} state={state} update={update} onNavigate={onNavigate} />;
  if (menu === "properties")
    return (
      <ScrollArea h="full" minH="0">
        <Stack p="md" gap="md">
          <Text textStyle="label/XS" color="fg.muted">
            {ticket.id}
          </Text>
          <Text textStyle="label/S">Status · In progress</Text>
          <Text textStyle="label/S">Priority · Medium</Text>
        </Stack>
      </ScrollArea>
    );
  return (
    <ScrollArea h="full" minH="0" contentProps={{ py: "sm" }}>
      <Activity.Timeline>
        <Activity.Event icon={<WorkbenchIcon name="GitBranch" />} timestamp="Just now">
          Workspace ready for review
        </Activity.Event>
        <Activity.Event actor={{ name: "Sam" }} icon={<WorkbenchIcon name="CircleDot" />} timestamp="10 minutes ago">
          Moved {ticket.id} to In progress
        </Activity.Event>
      </Activity.Timeline>
    </ScrollArea>
  );
};
