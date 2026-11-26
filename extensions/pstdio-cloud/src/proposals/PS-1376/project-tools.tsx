import { HStack, Stack, Text } from "@chakra-ui/react";
import { Checkbox, Chip, SimpleCard, SimpleCardBody, Switch } from "@pstdio/ui";
import { Button } from "../../button";
import type { TeamDemo } from "./demo-model";

export const ProjectTools = (props: { demo: TeamDemo; projectId: string }) => {
  const { demo, projectId } = props;
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="md">
          <HStack justify="space-between">
            <Text textStyle="label/M/medium">Project extensions</Text>
            {!demo.tools[projectId].some((tool) => tool.id === "notes") && (
              <Button size="sm" variant="outline" onClick={() => demo.restoreNotes(projectId)}>
                Add Notes
              </Button>
            )}
          </HStack>
          {demo.tools[projectId].map((tool) => {
            const required = demo.managedPreview && demo.requirements[projectId].includes(tool.id);
            return (
              <Stack key={tool.id} gap="sm">
                <HStack gap="sm" justify="space-between" flexWrap="wrap">
                  <Stack gap="2xs">
                    <HStack gap="xs">
                      <Text>{tool.name}</Text>
                      {required && <Chip>Required by team</Chip>}
                    </HStack>
                    <Text textStyle="label/S/regular" color="fg.muted">
                      {required ? "Installed for every project member" : "Shared project extension"}
                    </Text>
                  </Stack>
                  <HStack gap="sm">
                    <Switch
                      inputProps={{ "aria-label": `Enable ${tool.name}` }}
                      checked={required || tool.enabled}
                      disabled={required}
                      onCheckedChange={({ checked }) => demo.updateTool(projectId, tool.id, { enabled: checked })}
                    />
                    <Button
                      size="sm"
                      variant="destructive-ghost"
                      disabled={required}
                      onClick={() => demo.removeTool(projectId, tool.id)}
                    >
                      Remove {tool.name}
                    </Button>
                  </HStack>
                </HStack>
                {demo.managedPreview && demo.owner && (
                  <Checkbox
                    checked={demo.requirements[projectId].includes(tool.id)}
                    onCheckedChange={({ checked }) => demo.setRequired(projectId, tool.id, checked === true)}
                  >
                    Require {tool.name} in this project
                  </Checkbox>
                )}
              </Stack>
            );
          })}
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
