import { Button } from "@chakra-ui/react";
import { createGlyphIcon } from "@pstdio/ui";
import { useState } from "react";

const CopyIcon = createGlyphIcon("copy");

export const CopyStartupDiagnosticsButton = (props: { copyDiagnostics: () => Promise<void> }) => {
  const { copyDiagnostics } = props;
  const [status, setStatus] = useState<"ready" | "copying" | "copied" | "failed">("ready");
  const copy = async () => {
    setStatus("copying");
    try {
      await copyDiagnostics();
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };
  let label = "Copy diagnostics";
  if (status === "copied") label = "Copied";
  if (status === "failed") label = "Copy failed. Try again.";
  return (
    <Button aria-label="Copy diagnostics" loading={status === "copying"} onClick={copy}>
      <CopyIcon />
      {label}
    </Button>
  );
};
