import { Text } from "@chakra-ui/react";
import { CopyButton } from "@pstdio/ui";
import { LabCard } from "./lab-card";
export const ClipboardCard = () => (
  <LabCard title="Clipboard" subtitle="Copy text from a sandboxed extension view.">
    <Text textStyle="paragraph/S/regular">A draft ready to paste.</Text>
    <CopyButton text={"A draft ready to paste.\n\nKeep the exact spacing."} label="Copy extension draft" />
  </LabCard>
);
