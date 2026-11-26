import { Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { Chip, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";
import { Button } from "../../button";
import { people, type TeamDemo } from "./demo-model";
import { ProjectTools } from "./project-tools";

export const TeamProjects = (props: { demo: TeamDemo }) => {
  const { demo } = props;
  const [selected, setSelected] = useState("a");
  const visible = demo.projects.filter((project) => demo.owner || project.members.includes(demo.viewer));
  const project = visible.find((entry) => entry.id === selected) ?? visible[0];
  if (!project)
    return (
      <SimpleCard>
        <SimpleCardBody>
          <Text>No projects shared with you</Text>
        </SimpleCardBody>
      </SimpleCard>
    );
  const hasAccess = project.members.includes(demo.viewer);
  return (
    <Stack gap="md">
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="sm">
        {visible.map((entry) => (
          <Button
            key={entry.id}
            variant={entry.id === project.id ? "primary" : "outline"}
            onClick={() => setSelected(entry.id)}
          >
            {entry.name} · {entry.members.length} members
          </Button>
        ))}
      </Grid>
      <HStack justify="space-between" flexWrap="wrap" gap="sm">
        <Text textStyle="heading/S">{project.name}</Text>
        {hasAccess && <Chip>Full access</Chip>}
      </HStack>
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="md">
            <Text textStyle="label/M/medium">Project members</Text>
            {people
              .filter((person) => demo.members.includes(person.id))
              .map((person) => {
                const included = project.members.includes(person.id);
                return (
                  <HStack key={person.id} justify="space-between" gap="sm" flexWrap="wrap">
                    <Stack gap="2xs">
                      <Text>{person.name}</Text>
                      <Text textStyle="label/S/regular" color="fg.muted">
                        {included ? "Full project rights" : "No project access"}
                      </Text>
                    </Stack>
                    <Button
                      size="sm"
                      variant={included ? "destructive-ghost" : "outline"}
                      onClick={() => demo.toggleAccess(project.id, person.id)}
                    >
                      {included
                        ? `Remove ${person.name.split(" ")[0]} access`
                        : `Add ${person.name.split(" ")[0]} to project`}
                    </Button>
                  </HStack>
                );
              })}
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      {hasAccess ? (
        <ProjectTools demo={demo} projectId={project.id} />
      ) : (
        <Text color="fg.muted">Add yourself to this project to open its tools.</Text>
      )}
    </Stack>
  );
};
