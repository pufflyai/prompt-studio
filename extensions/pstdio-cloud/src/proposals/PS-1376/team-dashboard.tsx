import { HStack, Stack, Text } from "@chakra-ui/react";
import { Chip, ScrollArea, SegmentedControl, Switch } from "@pstdio/ui";
import { useState } from "react";
import { CloudIcon } from "../../cloud-label";
import { people, useTeamDemo } from "./demo-model";
import { JoinTeam, TeamPeople } from "./team-people";
import { TeamProjects } from "./team-projects";

export const TeamDashboard = () => {
  const demo = useTeamDemo();
  const [tab, setTab] = useState("people");
  const person = people.find((entry) => entry.id === demo.viewer)!;
  return (
    <Stack h="100dvh" minH="0" gap="0" bg="bg" color="fg">
      <Stack p="sm" gap="sm" bg="bg.subtle" borderBottomWidth="1px" flexShrink="0">
        <HStack justify="space-between" flexWrap="wrap" gap="sm">
          <Text textStyle="label/S/regular" color="fg.muted">
            Demo · sample team
          </Text>
          <Switch checked={demo.managedPreview} onCheckedChange={({ checked }) => demo.setManagedPreview(checked)}>
            Preview managed extensions
          </Switch>
        </HStack>
        <SegmentedControl
          aria-label="Preview as"
          value={demo.viewer}
          onValueChange={demo.setViewer}
          options={[
            { value: "alex", label: "Alex · team owner" },
            { value: "morgan", label: "Morgan · member" },
            { value: "riley", label: "Riley · invite recipient" },
          ]}
        />
      </Stack>
      <Stack as="header" p="lg" gap="md" borderBottomWidth="1px" flexShrink="0">
        <HStack justify="space-between" flexWrap="wrap" gap="sm">
          <HStack gap="sm">
            <CloudIcon name="cloud" />
            <Text textStyle="heading/M">Cloud</Text>
          </HStack>
          <Text color="fg.muted">{person.name}</Text>
        </HStack>
        <HStack justify="space-between" gap="sm" flexWrap="wrap">
          <Text textStyle="heading/S">{demo.joined ? "Studio Team" : "Your teams"}</Text>
          {demo.joined && <Chip>{demo.owner ? "Team owner" : "Team member"}</Chip>}
        </HStack>
        {demo.joined && (
          <SegmentedControl
            aria-label="Cloud team sections"
            options={[
              { value: "people", label: "People" },
              { value: "projects", label: "Projects" },
            ]}
            value={tab}
            onValueChange={setTab}
          />
        )}
      </Stack>
      <ScrollArea flex="1" minH="0">
        <Stack p="lg" gap="lg" maxW="5xl" mx="auto" w="full">
          {demo.managedPreview && (
            <Text color="fg.muted" textStyle="label/S/regular">
              Future policy preview · required extensions are managed by the team owner.
            </Text>
          )}
          {!demo.joined && <JoinTeam demo={demo} />}
          {demo.joined && tab === "people" && <TeamPeople demo={demo} />}
          {demo.joined && tab === "projects" && <TeamProjects demo={demo} />}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};
