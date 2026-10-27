import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
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
  deviceName: string;
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
  return (
    <Box role="list" aria-label={label} css={styles.participants}>
      {participants.map((participant) => {
        const identity = `${participant.label} · ${participant.deviceName}`;
        return (
          <Tooltip key={participant.id} content={identity}>
            <Box role="listitem" aria-label={identity} colorPalette={participant.color} css={styles.participant}>
              <Box aria-hidden="true" css={styles.dot} />
              <Text as="span" truncate>
                {identity}
              </Text>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};
