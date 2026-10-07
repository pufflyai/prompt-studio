// Draw a milestone header as one line: toggle, editable name, status icons, a rule to the progress bar, and delete.
import { Box, Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { CheckCircle2, ChevronsDownUp, ChevronsUpDown, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { isComplete } from "../model/filter";
import { formatDay } from "./flags";
import { InlineText } from "./inline-edit";
import type { PlanViewProps, ViewSection } from "./plan-view";

type Props = Pick<PlanViewProps, "onToggle" | "onDelete" | "onRenameDeadline" | "onReview"> & {
  entry: ViewSection;
  targeted?: boolean;
};

function Progress({ entry }: { entry: ViewSection }) {
  const { done, total } = entry.section.counts;
  return (
    <Tooltip content={`${done} of ${total} tickets done`}>
      <Box
        role="progressbar"
        aria-label="Milestone progress"
        aria-valuemin={0}
        aria-valuemax={total || 1}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} tickets done`}
        tabIndex={0}
        w="64px"
        h="4px"
        bg="bg.emphasized"
        borderRadius="0"
        overflow="hidden"
        flexShrink="0"
      >
        <Box w={`${total ? (done / total) * 100 : 0}%`} h="full" bg="green.fg" borderRadius="0" />
      </Box>
    </Tooltip>
  );
}

// Deleting asks for a second click, so a stray click cannot remove a milestone.
function DeleteButton({
  deadlineId,
  label,
  onDelete,
}: { deadlineId: string; label: string } & Pick<Props, "onDelete">) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Tooltip content={confirming ? "Click again to delete; its tickets become unscheduled" : "Delete milestone"}>
      <IconButton
        size="2xs"
        variant="ghost"
        aria-label={confirming ? `Confirm deleting ${label}` : `Delete ${label}`}
        color={confirming ? "red.fg" : "fg.subtle"}
        onBlur={() => setConfirming(false)}
        onMouseLeave={() => setConfirming(false)}
        onClick={() => (confirming ? onDelete(deadlineId) : setConfirming(true))}
      >
        <Icon as={Trash2} />
      </IconButton>
    </Tooltip>
  );
}

export function SectionHeader({ entry, targeted, onToggle, onDelete, onRenameDeadline, onReview }: Props) {
  const { deadline, counts } = entry.section;
  const complete = isComplete(entry.section);
  const label = deadline ? (deadline.name ?? formatDay(deadline.date)) : "Unscheduled";
  return (
    <Flex align="center" gap="xs" h="full" minW="0" pr="sm" bg="bg" position="relative" isolation="isolate">
      {targeted ? <Box position="absolute" inset="0" bg="border.accent/6" zIndex="-1" pointerEvents="none" /> : null}
      <Tooltip content={`${entry.collapsed ? "Expand" : "Collapse"} ${label}`}>
        <IconButton
          size="2xs"
          variant="ghost"
          color="fg.subtle"
          aria-label={`${entry.collapsed ? "Expand" : "Collapse"} ${label}`}
          onClick={() => onToggle(deadline?.id ?? null)}
        >
          <Icon as={entry.collapsed ? ChevronsUpDown : ChevronsDownUp} />
        </IconButton>
      </Tooltip>
      {deadline ? (
        <InlineText
          value={deadline.name ?? ""}
          placeholder={formatDay(deadline.date)}
          label={`${label} milestone name`}
          color="fg.muted"
          onSave={(name) => onRenameDeadline(deadline.id, name)}
        />
      ) : (
        <Text textStyle="label/S/medium" color="fg.muted" px="2xs">
          Unscheduled
        </Text>
      )}
      {counts.humanNeeded > 0 ? (
        <Tooltip content={`${counts.humanNeeded} tickets need human review · open them`}>
          <IconButton
            size="2xs"
            variant="ghost"
            color="orange.fg"
            aria-label={`Review ${counts.humanNeeded} tickets that need a person in ${label}`}
            onClick={() => onReview(deadline?.id ?? null)}
          >
            <Icon as={UserRound} />
            <Text textStyle="label/XS/medium">{counts.humanNeeded}</Text>
          </IconButton>
        </Tooltip>
      ) : null}
      {complete ? (
        <Tooltip content="Milestone complete">
          <Box role="img" aria-label="Milestone complete" tabIndex={0} display="flex" color="green.fg">
            <Icon as={CheckCircle2} boxSize="15px" />
          </Box>
        </Tooltip>
      ) : null}
      <Box flex="1" minW="16px" h="1px" bg={targeted ? "border.accent/60" : "border"} mx="xs" />
      <Progress entry={entry} />
      {deadline ? <DeleteButton deadlineId={deadline.id} label={label} onDelete={onDelete} /> : null}
    </Flex>
  );
}
