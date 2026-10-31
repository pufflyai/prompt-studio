import { IconButton, type IconButtonProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/primitives/tooltip";

interface ActionIconButtonProps extends IconButtonProps {
  tooltip: ReactNode;
}

export const ActionIconButton = (props: ActionIconButtonProps) => {
  const { tooltip, ...buttonProps } = props;
  // Menu triggers pass their handlers and ref through this component to the button.
  return (
    <Tooltip content={tooltip}>
      <IconButton {...buttonProps} />
    </Tooltip>
  );
};
