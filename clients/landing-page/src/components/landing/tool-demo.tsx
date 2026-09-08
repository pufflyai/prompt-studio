import { Box, Button, HStack, Icon, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Checkbox, SegmentedControl, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { ArrowUpRight, Check, Clock3, GripVertical } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ToolShapeKind } from "../shapes/tool-shapes";
import { BlockChip, BlockSymbol, useStoryStyles } from "./building-blocks";
import { FEEDBACK_ITEMS, RESEARCH_SOURCES, type ToolExampleId } from "./tool-examples-content";

interface DemoPanelProps {
  title: string;
  kind: ToolShapeKind;
  highlighted?: ToolShapeKind;
  children: ReactNode;
}

export const DemoPanel = (props: DemoPanelProps) => {
  const { title, kind, highlighted, children } = props;
  const styles = useStoryStyles();
  return (
    <Box css={styles.panel} data-highlighted={kind === highlighted}>
      <Box css={styles.panelHeader}>
        <BlockSymbol kind={kind} />
        <Text flex="1">{title}</Text>
        <Icon as={GripVertical} boxSize="icon-sm" color="fg.subtle" />
      </Box>
      <Box css={styles.panelBody}>{children}</Box>
    </Box>
  );
};

export const DemoWorkbench = (props: { children: ReactNode; name?: string }) => {
  const { children, name = "My workbench" } = props;
  const styles = useStoryStyles();
  return (
    <Box css={styles.visual}>
      <Box css={styles.visualHeader}>
        <Text>{name}</Text>
        <Text>Interactive example</Text>
      </Box>
      {children}
    </Box>
  );
};

export const ResearchDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [source, setSource] = useState(0);
  const [drafted, setDrafted] = useState(false);
  const styles = useStoryStyles();
  return (
    <Box css={styles.panels}>
      <DemoPanel title="Research library" kind="page" highlighted={highlighted}>
        <Text textStyle="label/S/regular" color="fg.muted">
          3 sources for a better first week
        </Text>
        <Stack gap="xs">
          {RESEARCH_SOURCES.map((item, index) => (
            <Button
              key={item.title}
              variant="ghost"
              size="lg"
              justifyContent="start"
              aria-pressed={source === index}
              onClick={() => setSource(index)}
            >
              <Stack gap="0" align="start" minWidth="0">
                <Text truncate>{item.title}</Text>
                <Text textStyle="label/XS" color="fg.muted">
                  {item.meta}
                </Text>
              </Stack>
            </Button>
          ))}
        </Stack>
        <SimpleCard>
          <SimpleCardBody>
            <Text textStyle="paragraph/M/regular">{RESEARCH_SOURCES[source].finding}</Text>
          </SimpleCardBody>
        </SimpleCard>
        <Button variant="outline" alignSelf="start" onClick={() => setDrafted(!drafted)}>
          <BlockSymbol kind="command" />
          {drafted ? "Reset example brief" : "Draft a brief"}
          <Icon as={ArrowUpRight} boxSize="icon-sm" />
        </Button>
      </DemoPanel>
      <DemoPanel title="Launch brief" kind="editor" highlighted={highlighted}>
        <Text textStyle="label/S/regular" color="fg.muted">
          launch-brief.md
        </Text>
        <Text as="h3" textStyle="heading/M">
          A simpler first week
        </Text>
        <Text textStyle="paragraph/M/regular">Help new customers reach their first useful result.</Text>
        <Stack gap="sm">
          <Text textStyle="label/M/medium">What we learned</Text>
          <Text textStyle="paragraph/M/regular" color="fg.muted">
            {drafted ? RESEARCH_SOURCES.map((item) => item.finding).join(" ") : RESEARCH_SOURCES[source].finding}
          </Text>
        </Stack>
        <Stack gap="sm">
          <Text textStyle="label/M/medium">What to try</Text>
          <Text textStyle="paragraph/M/regular">
            {drafted
              ? "Simplify the first screen, add an example, and make the next step visible."
              : RESEARCH_SOURCES[source].action}
          </Text>
        </Stack>
        <HStack mt="auto" pt="sm" justify="space-between" flexWrap="wrap">
          <BlockChip kind="skill" />
          <Text aria-live="polite" textStyle="label/S/regular" color="fg.muted">
            {drafted ? "Example draft from all 3 sources" : "Select a source to explore"}
          </Text>
        </HStack>
      </DemoPanel>
    </Box>
  );
};

export const FeedbackDemo = (props: { withFilter?: boolean; highlighted?: ToolShapeKind }) => {
  const { withFilter = true, highlighted } = props;
  const [owner, setOwner] = useState("All owners");
  const items = FEEDBACK_ITEMS.filter((item) => !withFilter || owner === "All owners" || item.owner === owner);
  return (
    <DemoPanel title="Feedback board" kind="page" highlighted={highlighted}>
      {withFilter && (
        <SegmentedControl
          aria-label="Filter feedback by owner"
          value={owner}
          onValueChange={setOwner}
          options={["All owners", "Alex", "Sam"].map((value) => ({ value, label: value }))}
        />
      )}
      <SimpleGrid columns={2} gap="sm">
        {["To review", "Planned"].map((status) => (
          <Stack key={status} gap="sm" minWidth="0">
            <Text textStyle="label/S/medium" color="fg.muted">
              {status}
            </Text>
            {items
              .filter((item) => item.status === status)
              .map((item) => (
                <SimpleCard key={item.title}>
                  <SimpleCardBody>
                    <Stack gap="lg">
                      <Text textStyle="paragraph/M/regular">{item.title}</Text>
                      <Text textStyle="label/S/regular" color="fg.muted">
                        {item.owner}
                      </Text>
                    </Stack>
                  </SimpleCardBody>
                </SimpleCard>
              ))}
          </Stack>
        ))}
      </SimpleGrid>
      <HStack justify="space-between" flexWrap="wrap" pt="sm">
        <BlockChip kind="hook" />
        <Text textStyle="label/S/regular" color="fg.muted" aria-live="polite">
          {items.length} feedback items
        </Text>
      </HStack>
    </DemoPanel>
  );
};

export const BriefDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [refreshed, setRefreshed] = useState(false);
  const styles = useStoryStyles();
  return (
    <Box css={styles.panels}>
      <DemoPanel title="Morning routine" kind="automation" highlighted={highlighted}>
        <Icon as={Clock3} boxSize="8" color="fg.muted" />
        <Text textStyle="heading/M">Ready by 9:00</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Every weekday, collect the updates and prepare a brief.
        </Text>
        <HStack>
          <Icon as={Check} boxSize="icon-sm" />
          <Text textStyle="label/S/regular">Last example run completed</Text>
        </HStack>
        <Button alignSelf="start" onClick={() => setRefreshed(!refreshed)}>
          <BlockSymbol kind="command" />
          {refreshed ? "Reset example" : "Run example now"}
        </Button>
      </DemoPanel>
      <DemoPanel title="Your daily brief" kind="page" highlighted={highlighted}>
        <Text textStyle="heading/M">Good morning.</Text>
        <Text textStyle="paragraph/M/regular" color="fg.muted">
          Here is what needs your attention.
        </Text>
        {["2 proposals ready for review", "A new customer interview", "Weekly report prepared"].map((item) => (
          <Box key={item} css={styles.row}>
            <Text textStyle="paragraph/M/regular">{item}</Text>
            <Icon as={ArrowUpRight} boxSize="icon-sm" />
          </Box>
        ))}
        <Text textStyle="label/S/regular" color="fg.muted" aria-live="polite">
          {refreshed ? "Example brief refreshed just now" : "Prepared at 9:00 · 3 updates"}
        </Text>
      </DemoPanel>
    </Box>
  );
};

export const TaskDemo = () => (
  <DemoPanel title="Launch plan" kind="page">
    <Text textStyle="paragraph/M/regular" color="fg.muted">
      Three next steps from the brief. Try checking one off.
    </Text>
    {RESEARCH_SOURCES.map((source) => (
      <Checkbox key={source.action}>{source.action}</Checkbox>
    ))}
  </DemoPanel>
);

export const ToolDemo = (props: { example: ToolExampleId; highlighted?: ToolShapeKind }) => {
  const { example, highlighted } = props;
  if (example === "feedback") return <FeedbackDemo highlighted={highlighted} />;
  if (example === "brief") return <BriefDemo highlighted={highlighted} />;
  return <ResearchDemo highlighted={highlighted} />;
};
