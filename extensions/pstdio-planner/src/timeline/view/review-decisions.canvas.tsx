import { Button, CloseButton, Dialog, HStack, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { Radio, RadioGroup, ScrollArea, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useState } from "react";

const decisions = [
  {
    id: "offline",
    ticket: "P-12 · Build a notes tool",
    problem: "Offline notes disappear when this browser's data is cleared.",
    solutions: ["Save a backup file (recommended)", "Keep notes only in this browser"],
    downsides: "Backup: one extra file to manage. Browser only: cleared notes cannot be recovered.",
  },
  {
    id: "sharing",
    ticket: "P-12 · Build a notes tool",
    problem: "A shared link could expose private notes.",
    solutions: ["Invite specific people (recommended)", "Let anyone with the link read"],
    downsides: "Invites: readers must sign in. Open link: readers can forward it to anyone.",
  },
];

// All decisions and answers belong to this preview. No Planner records are read or written.
function DecisionCarousel({ count = 2 }: { count?: number }) {
  const [pending, setPending] = useState(decisions.slice(0, count));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const decision = pending[index];
  if (!decision) return <Text>No decisions needed.</Text>;
  const save = () => {
    setPending(pending.filter((item) => item.id !== decision.id));
    setIndex(Math.max(0, Math.min(index, pending.length - 2)));
  };
  return (
    <Stack gap="md">
      <Text textStyle="label/S/medium">{decision.ticket}</Text>
      {pending.length > 1 ? (
        <HStack justify="space-between">
          <Button
            size="xs"
            variant="ghost"
            aria-label="Previous request"
            onClick={() => setIndex((index + pending.length - 1) % pending.length)}
          >
            Previous
          </Button>
          <Text aria-live="polite">
            {index + 1} of {pending.length}
          </Text>
          <Button
            size="xs"
            variant="ghost"
            aria-label="Next request"
            onClick={() => setIndex((index + 1) % pending.length)}
          >
            Next
          </Button>
        </HStack>
      ) : null}
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Problem</Text>
        <Text>{decision.problem}</Text>
      </Stack>
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Solutions</Text>
        <RadioGroup
          value={answers[decision.id] ?? ""}
          onValueChange={({ value }) => setAnswers({ ...answers, [decision.id]: value ?? "" })}
        >
          {decision.solutions.map((solution) => (
            <Radio key={solution} value={solution}>
              {solution}
            </Radio>
          ))}
        </RadioGroup>
      </Stack>
      <Stack gap="xs">
        <Text textStyle="label/S/medium">Downsides</Text>
        <Text>{decision.downsides}</Text>
      </Stack>
      <Button size="sm" alignSelf="start" disabled={!answers[decision.id]} onClick={save}>
        Save decision
      </Button>
    </Stack>
  );
}

function InlineAutoBuild({ count = 2 }: { count?: number }) {
  return (
    <Popover.Root defaultOpen positioning={{ placement: "bottom-start" }}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="outline">
          Auto Build · {count} {count === 1 ? "decision" : "decisions"}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>
              <DecisionCarousel count={count} />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

function PlannerCardModal() {
  return (
    <Dialog.Root size="md" scrollBehavior="inside">
      <SimpleCard>
        <SimpleCardBody>
          <Stack gap="sm">
            <Text textStyle="label/M/medium">P-12 · Build a notes tool</Text>
            <Dialog.Trigger asChild>
              <Button size="sm" variant="outline">
                2 decisions needed
              </Button>
            </Dialog.Trigger>
          </Stack>
        </SimpleCardBody>
      </SimpleCard>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Review decisions</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <ScrollArea>
                <DecisionCarousel />
              </ScrollArea>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function ResourceBlocked() {
  return (
    <SimpleCard>
      <SimpleCardBody>
        <Stack gap="sm">
          <Text textStyle="label/M/medium">P-21 · Import the customer list</Text>
          <Text color="fg.error">Blocked</Text>
          <Text>Missing resource: upload the customer CSV to continue.</Text>
        </Stack>
      </SimpleCardBody>
    </SimpleCard>
  );
}

export default { title: "Extensions/Planner/Review decisions" };
export const AutoBuildCarousel = { name: "Auto Build — decision carousel", render: () => <InlineAutoBuild /> };
export const AutoBuildSingle = { name: "Auto Build — one decision", render: () => <InlineAutoBuild count={1} /> };
export const CardModal = { name: "Planner card — decision modal", render: () => <PlannerCardModal /> };
export const MissingResource = { name: "Missing resource — blocked reason", render: () => <ResourceBlocked /> };
