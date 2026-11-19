import { Tooltip, useTooltipContext } from "@chakra-ui/react";
import { createContext, useEffect, useLayoutEffect, useRef } from "react";
import { useUiScopeViewActivity } from "./ui-scope";
import { useScopedOpen } from "./use-scoped-open";

export const TooltipPresence = createContext(false);
const TooltipHoverReset = (props: { disabled: boolean }) => {
  const { disabled } = props;
  const api = useTooltipContext();
  const activity = useUiScopeViewActivity();
  const previousRevision = useRef(activity.revision);
  const lastEnabledLeave = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    if (!disabled) lastEnabledLeave.current = api.getTriggerProps().onPointerLeave as (() => void) | undefined;
  }, [api, disabled]);

  useLayoutEffect(() => {
    // Zag ignores leave while disabled; its current callback does not use an event.
    // See documentation/adrs/0088-temporary-tooltip-hover-reset.md.
    if (disabled) lastEnabledLeave.current?.();
  }, [disabled]);

  useEffect(() => {
    // Zag queues machine restart in its layout effect; resetting earlier drops the leave event.
    if (previousRevision.current !== activity.revision) lastEnabledLeave.current?.();
    previousRevision.current = activity.revision;
  }, [activity.revision]);

  return null;
};

const TooltipRoot = (props: Tooltip.RootProps) => (
  <TooltipPresence value={true}>
    <Tooltip.Root {...useScopedOpen(props)}>
      <TooltipHoverReset disabled={props.disabled ?? false} />
      {props.children}
    </Tooltip.Root>
  </TooltipPresence>
);
export const ScopedTooltip: typeof Tooltip = { ...Tooltip, Root: TooltipRoot };
