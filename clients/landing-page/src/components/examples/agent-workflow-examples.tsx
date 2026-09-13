import { Code, Stack, Text } from "@chakra-ui/react";
import { AGENT_WORKFLOW_EXAMPLES } from "../../content/agent-workflow-content";
import { DemoPanel } from "./demo-workbench";

export const AgentWorkflowExamples = (props: { highlighted: "command" | "skill" | "automation" }) => {
  const { highlighted } = props;
  const group = AGENT_WORKFLOW_EXAMPLES.find((example) => example.kind === highlighted)!;

  return (
    <DemoPanel key={group.kind} title={group.title} kind={group.kind} highlighted={highlighted}>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {group.description}
      </Text>
      {group.examples.map((example) => (
        <Stack key={example.title} gap="sm">
          <Text as="h2" textStyle="label/M/medium">
            {example.title}
          </Text>
          <Text textStyle="paragraph/S/regular">{example.detail}</Text>
          {"code" in example && (
            <Code whiteSpace="pre-wrap" overflowWrap="anywhere">
              {example.code}
            </Code>
          )}
        </Stack>
      ))}
    </DemoPanel>
  );
};
