import { type ComponentType, useEffect, useState } from "react";

type Callback = (...values: any[]) => unknown;

interface LiveFrameProps {
  Frame: ComponentType<Record<string, unknown>>;
  args: Record<string, unknown>;
  overrides?: Record<string, unknown>;
}

// Frames keep the state their controls change, using the common React prop conventions, so a
// person can try an example without each canvas wiring its own state.
export const LiveFrame = (props: LiveFrameProps) => {
  const { Frame } = props;
  const [args, setArgs] = useState(props.args);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (props.overrides && Object.keys(props.overrides).length)
      setArgs((current) => ({ ...current, ...props.overrides }));
  }, [props.overrides]);
  const update = (change: Record<string, unknown>) => setArgs((current) => ({ ...current, ...change }));
  const callbacks: Record<string, Callback> = {};
  const chain = (name: string, apply: Callback) => {
    callbacks[name] = (...values) => {
      const original = args[name];
      const result = typeof original === "function" ? original(...values) : undefined;
      apply(...values);
      return result;
    };
  };
  if ("value" in args) {
    chain("onChange", (event) => update({ value: event?.target?.value ?? event }));
    chain("onValueChange", (value) => update({ value: value?.value ?? value }));
  }
  if ("checked" in args) chain("onCheckedChange", (value) => update({ checked: value?.checked ?? value }));
  if ("open" in args) chain("onOpenChange", (value) => update({ open: value?.open ?? value }));
  if ("onClose" in args)
    callbacks.onClose = async (...values: unknown[]) => {
      const original = args.onClose;
      const result = typeof original === "function" ? await original(...values) : undefined;
      // A handler that returns false keeps the example open, as the component would.
      if (result === false) return result;
      if ("open" in args) update({ open: false });
      else setClosed(true);
      return result ?? true;
    };
  if (closed) return <p role="status">Example closed. Reset the frame to try it again.</p>;
  return <Frame {...args} {...callbacks} />;
};
