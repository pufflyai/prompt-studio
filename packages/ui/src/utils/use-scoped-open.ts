import { useEffectEvent, useLayoutEffect, useState } from "react";
import { useUiScope, useUiScopeViewActivity } from "./ui-scope";

/** Suspend overlays with their surface, but dismiss them when their owning view is left. */
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
  const activity = useUiScopeViewActivity();
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [revision, setRevision] = useState(activity.revision);
  const expired = revision !== activity.revision;
  const dismiss = useEffectEvent(() => {
    setOpen(false);
    props.onOpenChange?.({ open: false });
  });
  useLayoutEffect(() => {
    if (revision !== activity.revision && !(props.open ?? open)) setRevision(activity.revision);
    if ((!activity.active || revision !== activity.revision) && (props.open ?? open)) dismiss();
  }, [activity.active, activity.revision, revision, props.open, open]);
  if (!scope && !activity.owned) return props;
  const active = activity.active && (scope?.active ?? true);
  return {
    ...props,
    open: active && !expired && (props.open ?? open),
    unmountOnExit: active ? props.unmountOnExit : false,
    onOpenChange: (details: { open: boolean }) => {
      if (!active || expired) return;
      setOpen(details.open);
      props.onOpenChange?.(details);
    },
  };
};
