import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createExampleStore, initials, useExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import { exampleDefaults } from "../state-defaults";
import type { ExampleViewInput } from "../view-context";
import { type IssueStatus, type ZiplineIssue, ziplineIssues } from "./zipline-data";

const _page: PageRef = { extensionId: "pstdio.extension-lab", kind: "page", id: "zipline-resource" };
const _resource = (issue: ZiplineIssue): ResourceRef => ({ type: "zipline.issue", id: issue.id, label: issue.title });
export const ziplineStore = createExampleStore("zipline", exampleDefaults.zipline);
const statusIcons: Record<IssueStatus, string> = {
  Backlog: "Circle",
  "In progress": "CircleDotDashed",
  Done: "CircleCheckBig",
};
const _statusColors: Record<IssueStatus, string> = { Backlog: "gray", "In progress": "purple", Done: "green" };
const nextStatuses: Record<IssueStatus, IssueStatus> = {
  Backlog: "In progress",
  "In progress": "Done",
  Done: "Backlog",
};

export const IssueInspector = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const state = useExampleStore(ziplineStore);
  const issue = ziplineIssues.find((item) => item.id === input.resource?.id);
  if (!issue) return null;
  const status = state.statuses[issue.id];
  const nextStatus = nextStatuses[status];
  return (
    <Stack h="full" overflowY="auto" p="lg" gap="xl">
      <HStack justify="space-between">
        <HStack>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            {issue.id}
          </Text>
          <Badge variant="outline">{issue.team}</Badge>
        </HStack>
      </HStack>
      <Stack gap="sm">
        <Text textStyle="heading/L/semibold">{issue.title}</Text>
        <Text color="fg.muted" textStyle="paragraph/M/regular">
          {issue.summary}
        </Text>
      </Stack>
      <Stack gap="sm">
        <Text textStyle="label/XS" color="fg.muted">
          STATUS
        </Text>
        <Button
          aria-label={`Change status from ${status} to ${nextStatus}`}
          variant="subtle"
          justifyContent="flex-start"
          onClick={() => ziplineStore.setState({ statuses: { ...state.statuses, [issue.id]: nextStatus } })}
        >
          <ExampleIcon name={statusIcons[status]} />
          <Text flex="1" textAlign="left">
            {status}
          </Text>
          <ExampleIcon name="ChevronRight" color="fg.muted" />
        </Button>
      </Stack>
      <Stack gap="md">
        <Text textStyle="label/XS" color="fg.muted">
          DETAILS
        </Text>
        {[
          ["Priority", issue.priority],
          ["Assignee", issue.assignee],
          ["Team", issue.team],
        ].map(([label, value]) => (
          <HStack key={label} justify="space-between">
            <Text color="fg.muted" textStyle="paragraph/S/regular">
              {label}
            </Text>
            <Text textStyle="paragraph/S/semibold">{value}</Text>
          </HStack>
        ))}
      </Stack>
      <Stack gap="sm">
        <Text textStyle="label/XS" color="fg.muted">
          ACTIVITY
        </Text>
        <HStack align="start">
          <Box boxSize="7" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
            <Text textStyle="paragraph/XS/semibold">{initials(issue.assignee)}</Text>
          </Box>
          <Text textStyle="paragraph/S/regular">
            <Text as="span" fontWeight="semibold">
              {issue.assignee}
            </Text>{" "}
            moved this issue to {status}.
          </Text>
        </HStack>
      </Stack>
    </Stack>
  );
};

export const IssueCount = () => {
  const state = useExampleStore(ziplineStore);
  const open = Object.values(state.statuses).filter((status) => status !== "Done").length;
  return (
    <HStack h="full" px="sm">
      <ExampleIcon name="ListChecks" size={12} />
      <Text textStyle="paragraph/XS/regular">{open} open issues</Text>
    </HStack>
  );
};
