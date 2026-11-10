import { Avatar, Box, useSlotRecipe } from "@chakra-ui/react";
import { Tooltip } from "./tooltip";

export const documentParticipantColors = [
  "blue",
  "purple",
  "teal",
  "orange",
  "pink",
  "green",
  "cyan",
  "red",
  "yellow",
  "gray",
] as const;

export interface DocumentParticipant {
  id: string;
  label: string;
  color: (typeof documentParticipantColors)[number];
}

export interface DocumentParticipantsProps {
  participants: readonly DocumentParticipant[];
  label: string;
}

/** The host removes disconnected participants; this component keeps no presence history. */
export const DocumentParticipants = (props: DocumentParticipantsProps) => {
  const { participants, label } = props;
  const styles = useSlotRecipe({ key: "documentPresence" })({});
  if (!participants.length) return null;
  const visible = participants.slice(0, 3);
  const remaining = participants.slice(3);
  return (
    <Box role="list" aria-label={label} css={styles.participants}>
      {visible.map((participant) => {
        const identity = participant.label;
        return (
          <Tooltip key={participant.id} content={identity}>
            <Box role="listitem" aria-label={identity} colorPalette={participant.color} css={styles.participant}>
              <Avatar.Root size="2xs" colorPalette={participant.color}>
                <Avatar.Fallback name={identity} />
              </Avatar.Root>
            </Box>
          </Tooltip>
        );
      })}
      {remaining.length > 0 ? (
        <Tooltip content={remaining.map((person) => person.label).join(", ")}>
          <Box role="listitem" aria-label={remaining.map((person) => person.label).join(", ")} css={styles.participant}>
            <Avatar.Root size="2xs">
              <Avatar.Fallback>+{remaining.length}</Avatar.Fallback>
            </Avatar.Root>
          </Box>
        </Tooltip>
      ) : null}
    </Box>
  );
};
