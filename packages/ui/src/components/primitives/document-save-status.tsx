import { Box, useSlotRecipe } from "@chakra-ui/react";

export interface DocumentSaveStatusProps {
  pending: boolean;
  connected: boolean;
}

export const DocumentSaveStatus = (props: DocumentSaveStatusProps) => {
  const { pending, connected } = props;
  const styles = useSlotRecipe({ key: "documentPresence" })({});
  let label = pending ? "Saving…" : "Saved locally";
  if (!connected) label = pending ? "Not saved · Reconnecting" : "Saved locally · Reconnecting";
  return (
    <Box role="status" aria-label="Document save status" css={styles.status}>
      {label}
    </Box>
  );
};
