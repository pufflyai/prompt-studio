import { Button } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import { shortSha } from "./format";

interface CopyShaProps {
  sha: string;
}

// A short hash that copies the full one on click, wherever a commit is shown.
export const CopySha = (props: CopyShaProps) => {
  const { sha } = props;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    await navigator.clipboard.writeText(sha).then(
      () => setCopied(true),
      () => setCopied(false),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tooltip content={copied ? "Copied" : `Copy ${sha}`} closeDelay={150}>
      <Button
        size="2xs"
        variant="ghost"
        textStyle="mono/XS"
        px="1"
        minW="0"
        h="auto"
        aria-label={copied ? "Copied" : `Copy commit ${sha}`}
        onClick={copy}
      >
        {shortSha(sha)}
      </Button>
    </Tooltip>
  );
};
