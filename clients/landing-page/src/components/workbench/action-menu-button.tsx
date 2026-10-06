import { Button, Kbd } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { useLandingStyles } from "../../hooks/use-landing-styles";

interface ActionMenuButtonProps {
  open: boolean;
  onOpen: () => void;
}

export const ActionMenuButton = (props: ActionMenuButtonProps) => {
  const { open, onOpen } = props;
  const styles = useLandingStyles();
  const [modifier, setModifier] = useState("Ctrl");

  // The first render matches static HTML; the browser supplies its platform after hydration.
  useEffect(() => setModifier(navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"), []);

  return (
    <Tooltip content="Open action menu" openDelay={300} closeDelay={150}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        css={styles.actionMenuButton}
        aria-label="Open action menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="Meta+P Control+P"
        onClick={onOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <Kbd variant="plain" size="sm">
          {modifier} P
        </Kbd>
      </Button>
    </Tooltip>
  );
};
