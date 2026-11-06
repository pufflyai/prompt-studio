import { Stack } from "@chakra-ui/react";
import { Cloud, Gauge, Play } from "lucide-react";
import { CopyButton } from "../primitives/copy-button";
import { PopoverHeader } from "./popover-header";

export default { title: "Design system/Components/Overlays/Popover header" };

export const TitledPopovers = () => (
  <Stack gap="md">
    <PopoverHeader icon={<Cloud />} title="Prompt Studio Cloud" />
    <PopoverHeader
      icon={<Gauge />}
      title="Performance"
      actions={<CopyButton label="Copy performance snapshot" text='{"frameRate":60}' />}
    />
    <PopoverHeader icon={<Play />} title="Auto Build" />
  </Stack>
);
