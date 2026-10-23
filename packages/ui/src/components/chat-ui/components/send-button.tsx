import { IconButton, type IconButtonProps, Kbd } from "@chakra-ui/react";
import { ArrowUp, Pause } from "lucide-react";
import { Tooltip } from "@/components/primitives/tooltip";

export interface SendButtonProps extends IconButtonProps {
  shortcut?: string;
  title?: string;
  canInterrupt: boolean;
}

export const SendButton = (props: SendButtonProps) => {
  const { title, shortcut, canInterrupt, ...rest } = props;
  const ariaLabel = rest["aria-label"] ?? title;

  const icon = canInterrupt ? (
    <Pause size={16} strokeWidth={2} fill="currentColor" />
  ) : (
    <ArrowUp size={16} strokeWidth={2} />
  );

  const button = (
    <IconButton
      data-testid="send-message-button"
      size="xs"
      variant="primary"
      aria-label={ariaLabel}
      title={title}
      {...rest}
    >
      {icon}
    </IconButton>
  );

  if (title) {
    const tooltipContent = shortcut ? (
      <>
        {title} <Kbd fontSize="xs">{shortcut}</Kbd>
      </>
    ) : (
      title
    );

    return (
      <Tooltip content={tooltipContent} closeDelay={50}>
        {button}
      </Tooltip>
    );
  }

  return button;
};
