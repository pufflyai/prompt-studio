import { Icon } from "@chakra-ui/react";
import { ResourceBadge } from "@pstdio/ui";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
export const SourceContext = createContext<(path: string) => void>(() => {});
export function RuleTag(props: { reference: string; title?: string; onOpen: (ref: string) => void }) {
  const { reference, title, onOpen } = props;
  return (
    <ResourceBadge
      fileName={reference}
      tooltip={title ?? reference}
      size="sm"
      role="button"
      tabIndex={0}
      onSelect={() => onOpen(reference)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(reference);
        }
      }}
    />
  );
}
export function TestTag(props: { path: string }) {
  const { path } = props;
  const open = useContext(SourceContext);
  return (
    <ResourceBadge
      fileName={path.split("/").pop() ?? path}
      tooltip={path}
      size="sm"
      role="button"
      tabIndex={0}
      onSelect={() => open(path)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(path);
        }
      }}
    />
  );
}

export function RuleIdTag(props: { reference: string }) {
  const { reference } = props;
  const [state, setState] = useState<"ready" | "copied" | "failed">("ready");
  useEffect(() => {
    if (state === "ready") return;
    const timer = setTimeout(() => setState("ready"), 1500);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  let label = `Copy ${reference}`;
  let icon = Copy;
  if (state === "copied") {
    label = `Copied ${reference}`;
    icon = Check;
  }
  if (state === "failed") {
    label = `Copy failed. Try copying ${reference} again.`;
    icon = TriangleAlert;
  }
  return (
    <ResourceBadge
      fileName={state === "failed" ? `${reference} · Retry copy` : reference}
      icon={<Icon as={icon} boxSize="icon-xs" />}
      tooltip={label}
      size="sm"
      role="button"
      aria-label={label}
      tabIndex={0}
      onSelect={() => void copy()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          void copy();
        }
      }}
    />
  );
}
