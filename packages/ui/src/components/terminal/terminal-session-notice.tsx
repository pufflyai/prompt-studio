import { Box, useRecipe } from "@chakra-ui/react";
import { terminalSessionNoticeRecipe } from "../../theme/recipes/terminal-session-notice";
import type { TerminalSessionError } from "./types";

export const TerminalSessionNotice = ({ error, color }: { error?: TerminalSessionError; color?: string }) => {
  const styles = useRecipe({ recipe: terminalSessionNoticeRecipe })({ state: error ? "error" : "pending" });
  return (
    <Box css={styles} role={error ? "alert" : "status"} color={color}>
      {error ? "Could not open terminal" : "Opening terminal…"}
      {error && <div>{error.message}</div>}
    </Box>
  );
};
