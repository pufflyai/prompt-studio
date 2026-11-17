import { Button } from "@chakra-ui/react";
import { createGlyphIcon } from "@pstdio/ui";
import { useState } from "react";

const CopyIcon = createGlyphIcon("copy");

export const CopyStartupLogsButton = (props: { copyStartupLogs: () => Promise<void> }) => {
  const { copyStartupLogs } = props;
  const [status, setStatus] = useState<"ready" | "copying" | "copied" | "failed">("ready");
  const copy = async () => {
    setStatus("copying");
    try {
      await copyStartupLogs();
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };
  let label = "Copy logs";
  if (status === "copied") label = "Copied";
  if (status === "failed") label = "Copy failed. Try again.";
  return (
    <Button aria-label="Copy logs" loading={status === "copying"} onClick={copy}>
      <CopyIcon />
      {label}
    </Button>
  );
};
