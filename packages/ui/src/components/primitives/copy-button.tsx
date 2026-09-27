import { IconButton, type IconButtonProps } from "@chakra-ui/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "./tooltip";

export interface CopyButtonProps extends Omit<IconButtonProps, "children" | "onClick"> {
  text: string;
  label?: string;
  onCopy?: () => void;
  onCopyError?: (error: unknown) => void;
}

/** Webviews must declare clipboard.write. Copy from a click so browser activation is preserved. */
export const CopyButton = (props: CopyButtonProps) => {
  const { text, label = "Copy", onCopy, onCopyError, disabled, ...rest } = props;
  const [state, setState] = useState<"ready" | "copied" | "failed">("ready");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      onCopy?.();
    } catch (error) {
      setState("failed");
      onCopyError?.(error);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("ready"), 1500);
  };
  let status = label;
  if (state === "copied") status = "Copied";
  if (state === "failed") status = "Copy failed. Try again.";
  return (
    <Tooltip content={status} openDelay={300} closeDelay={150}>
      <IconButton variant="ghost" size="sm" {...rest} aria-label={status} disabled={disabled || !text} onClick={copy}>
        {state === "copied" ? <Check /> : <Copy />}
      </IconButton>
    </Tooltip>
  );
};
