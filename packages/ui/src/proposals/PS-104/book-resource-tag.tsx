import { Icon, Link } from "@chakra-ui/react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ResourceBadge } from "../../components/primitives/resource-badge";
import { testSourceHref } from "./book-model";

export function RuleTag({
  reference,
  title,
  onOpen,
}: {
  reference: string;
  title?: string;
  onOpen: (ref: string) => void;
}) {
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
export function TestTag({ path }: { path: string }) {
  return (
    <Link
      variant="resource"
      href={testSourceHref(path)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open test ${path}`}
    >
      <ResourceBadge fileName={path.split("/").pop()!} tooltip={path} size="sm" />
    </Link>
  );
}

export function RuleIdTag({ reference }: { reference: string }) {
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
