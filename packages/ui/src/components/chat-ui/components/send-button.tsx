import { IconButton, type IconButtonProps, Kbd, Portal, Tooltip } from "@chakra-ui/react";
import { ArrowUp, Square } from "lucide-react";

export interface SendButtonProps extends IconButtonProps {
  shortcut?: string;
  title?: string;
  canInterrupt: boolean;
}

export const SendButton = (props: SendButtonProps) => {
  const { title, shortcut, canInterrupt, ...rest } = props;
  const ariaLabel = rest["aria-label"] ?? title;

  const icon = canInterrupt ? (
    <Square size={16} strokeWidth={2} fill="currentColor" />
  ) : (
    <ArrowUp size={16} strokeWidth={2} />
  );

  const button = (
    <IconButton
      data-testid="send-message-button"
      size="sm"
      variant="primary"
      borderRadius="full"
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
      <Tooltip.Root closeDelay={50} openDelay={100}>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>{tooltipContent}</Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      </Tooltip.Root>
    );
  }

  return button;
};
