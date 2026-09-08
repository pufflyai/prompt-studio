import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ToolShapeKind } from "../shapes/tool-shapes";
import { BlockSymbol, useStoryStyles } from "./building-blocks";
import { DemoPanel, DemoWorkbench, FeedbackDemo, ResearchDemo, TaskDemo } from "./tool-demo";
import { RESEARCH_SOURCES } from "./tool-examples-content";

const WORKFLOW: { label: string; kind: ToolShapeKind }[] = [
  { label: "Collect research", kind: "page" },
  { label: "Write a brief", kind: "editor" },
  { label: "Create tasks", kind: "command" },
];

export const ConnectedToolsDemo = () => {
  const [step, setStep] = useState(0);
  const styles = useStoryStyles();
  return (
    <Stack gap="md">
      <Box css={styles.flow} role="group" aria-label="Explore an example workflow">
        {WORKFLOW.map((item, index) => (
          <Button key={item.label} variant="ghost" aria-pressed={step === index} onClick={() => setStep(index)}>
            <BlockSymbol kind={item.kind} />
            {item.label}
          </Button>
        ))}
      </Box>
      <DemoWorkbench name="Research → brief → plan">
        {step === 0 && (
          <DemoPanel title="Collected research" kind="page">
            {RESEARCH_SOURCES.map((source) => (
              <Box css={styles.row} key={source.title}>
                <Stack gap="xs">
                  <Text textStyle="label/M/medium">{source.title}</Text>
                  <Text textStyle="paragraph/M/regular" color="fg.muted">
                    {source.finding}
                  </Text>
                </Stack>
              </Box>
            ))}
          </DemoPanel>
        )}
        {step === 1 && (
          <DemoPanel title="A brief from your research" kind="editor">
            <Text textStyle="heading/M">A simpler first week</Text>
            <Text textStyle="paragraph/M/regular">
              Our interviews, onboarding notes, and support conversations point to the same opportunity. Help new
              customers reach a useful result sooner.
            </Text>
            <Text textStyle="paragraph/M/regular" color="fg.muted">
              Simplify the first screen. Add a guided example. Make the next step visible.
            </Text>
            <Text textStyle="label/S/regular" color="fg.muted">
              Based on all 3 sources
            </Text>
          </DemoPanel>
        )}
        {step === 2 && <TaskDemo />}
      </DemoWorkbench>
      <Text css={styles.caption}>An example of tools built to share their results in one project.</Text>
    </Stack>
  );
};

export const ChangeToolDemo = () => {
  const [changed, setChanged] = useState(false);
  const styles = useStoryStyles();
  return (
    <Stack gap="md">
      <Box css={styles.prompt}>
        <HStack>
          <BlockSymbol kind="skill" />
          <Text textStyle="label/S/medium">You and your agent</Text>
        </HStack>
        <Text textStyle="paragraph/L/regular">Add an owner filter to my feedback board.</Text>
        <Button alignSelf="start" onClick={() => setChanged(!changed)}>
          {changed ? "Reset example change" : "Try the example change"}
        </Button>
        {changed && (
          <Text aria-live="polite" css={styles.caption}>
            The owner filter is ready. Pick Alex or Sam below.
          </Text>
        )}
      </Box>
      <DemoWorkbench>
        <FeedbackDemo key={String(changed)} withFilter={changed} />
      </DemoWorkbench>
    </Stack>
  );
};

export const WorkbenchOverviewDemo = () => (
  <DemoWorkbench>
    <ResearchDemo />
  </DemoWorkbench>
);
