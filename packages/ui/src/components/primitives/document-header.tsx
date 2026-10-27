import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import { type DocumentParticipant, DocumentParticipants } from "./document-participants";

export interface DocumentHeaderProps {
  title: string;
  participants: readonly DocumentParticipant[];
}

export const DocumentHeader = (props: DocumentHeaderProps) => {
  const { title, participants } = props;
  const styles = useSlotRecipe({ key: "documentPresence" })({});
  const middle = Math.ceil(title.length / 2);
  return (
    <Box css={styles.header}>
      <Text css={styles.title} title={title} aria-label={title}>
        <Box as="span" css={styles.titleStart} aria-hidden="true">
          {title.slice(0, middle)}
        </Box>
        <Box as="span" css={styles.titleEnd} aria-hidden="true">
          <Box as="span" css={styles.titleSuffix}>
            {title.slice(middle)}
          </Box>
        </Box>
      </Text>
      <DocumentParticipants participants={participants} label="Other editors" />
    </Box>
  );
};
