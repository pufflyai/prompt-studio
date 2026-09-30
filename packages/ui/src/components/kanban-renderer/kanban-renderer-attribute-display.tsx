import { Icon, IconButton, Text } from "@chakra-ui/react";
import { ExternalLink } from "lucide-react";
import { Tooltip } from "../primitives/tooltip";
import type { resolveAttributeDisplay } from "./kanban-renderer-display-values";

const stopRowActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();

interface AttributeDisplayProps {
  label: string;
  display: NonNullable<ReturnType<typeof resolveAttributeDisplay>>;
}

export const KanbanRendererAttributeDisplay = (props: AttributeDisplayProps) => {
  const { label, display } = props;
  if (display.kind === "text") {
    return (
      <Text textStyle="label/XS" color="fg.muted" truncate title={display.value}>
        {display.value}
      </Text>
    );
  }
  const href = display.value;
  return (
    <Tooltip content={href} openDelay={300} closeDelay={150}>
      <IconButton asChild aria-label={label} variant="ghost" size="2xs">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stopRowActivation}
          onPointerDown={stopRowActivation}
          onKeyDown={stopRowActivation}
        >
          <Icon as={ExternalLink} boxSize="icon-2xs" />
        </a>
      </IconButton>
    </Tooltip>
  );
};
