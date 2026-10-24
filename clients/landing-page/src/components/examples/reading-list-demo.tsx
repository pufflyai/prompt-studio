import { Badge, Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { ArrowRight, BookOpen, Check, Folder, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { PROJECT_NOTES, PURPOSE_STEPS, READING_ITEMS } from "../../content/purpose-demo-content";
import { usePurposeStyles } from "../../hooks/use-landing-styles";
import { DemoPanel } from "./demo-workbench";
import { ReadingListPanel } from "./reading-list-panel";

export const ReadingListDemo = () => {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState(READING_ITEMS);
  const styles = usePurposeStyles();
  const current = PURPOSE_STEPS[step];
  return (
    <Box css={styles.layout} role="region" aria-label="Build and use a reading list">
      <Stack css={styles.conversation}>
        <Box as="nav" css={styles.steps} aria-label="Example steps">
          {PURPOSE_STEPS.map((stage, index) => (
            <Button
              key={stage.label}
              variant={step === index ? "subtle" : "ghost"}
              aria-pressed={step === index}
              onClick={() => setStep(index)}
            >
              <Text as="span" color="fg.muted">
                {index + 1}
              </Text>{" "}
              {stage.label}
            </Button>
          ))}
        </Box>
        <Stack css={styles.message}>
          <HStack gap="sm" textStyle="label/S/medium">
            <User size={16} /> You
          </HStack>
          <Text textStyle="paragraph/L/regular">
            {step === 2 ? "Add a filter for unread items." : "Build me a reading list beside my project notes."}
          </Text>
        </Stack>
        <Stack css={styles.message} aria-live="polite">
          <HStack gap="sm" textStyle="label/S/medium">
            <Sparkles size={16} /> Your agent
          </HStack>
          <HStack align="start" gap="sm">
            {step > 0 && <Check size={16} />}
            <Text textStyle="paragraph/M/regular">{current.reply}</Text>
          </HStack>
        </Stack>
        <Button variant="outline" onClick={() => setStep((step + 1) % PURPOSE_STEPS.length)}>
          {current.action}
          <ArrowRight />
        </Button>
      </Stack>
      <Box css={styles.workspace} role="group" aria-label="Example project workbench">
        <HStack css={styles.workspaceHeader}>
          <HStack gap="sm">
            <Folder size={16} />
            <Text textStyle="label/M/medium">Weekend reading</Text>
          </HStack>
          <Badge variant="subtle">Interactive example</Badge>
        </HStack>
        <Box css={styles.workspaceBody}>
          <DemoPanel title="Project notes" kind="editor">
            <Textarea css={styles.notes} aria-label="Project notes" defaultValue={PROJECT_NOTES} />
          </DemoPanel>
          {step === 0 ? (
            <Stack css={styles.message} justify="center" align="center" aria-label="A place for your next tool">
              <BookOpen size={32} />
              <Text textStyle="heading/S">A tool for this little gap.</Text>
              <Button variant="outline" onClick={() => setStep(1)}>
                Build this tool
                <ArrowRight />
              </Button>
            </Stack>
          ) : (
            <ReadingListPanel
              items={items}
              withFilter={step === 2}
              onToggle={(id) => setItems(items.map((item) => (item.id === id ? { ...item, read: !item.read } : item)))}
              onAdd={(title) => setItems([...items, { id: `reading-${items.length}`, title, read: false }])}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};
