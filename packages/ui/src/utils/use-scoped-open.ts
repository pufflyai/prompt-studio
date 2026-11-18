import { useState } from "react";
import { useUiScope } from "./ui-scope";

/** Closing the machine releases focus traps and document listeners without forgetting an open overlay. */
export const useScopedOpen = <
  Props extends {
    open?: boolean;
    defaultOpen?: boolean;
    unmountOnExit?: boolean;
    onOpenChange?: (details: { open: boolean }) => void;
  },
>(
  props: Props,
) => {
  const scope = useUiScope();
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  if (!scope) return props;
  return {
    ...props,
    open: scope.active && (props.open ?? open),
    unmountOnExit: scope.active ? props.unmountOnExit : false,
    onOpenChange: (details: { open: boolean }) => {
      if (!scope.active) return;
      setOpen(details.open);
      props.onOpenChange?.(details);
    },
  };
};
