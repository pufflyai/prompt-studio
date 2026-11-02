import { IconButton, Stack } from "@chakra-ui/react";
import { Cloud, Copy, Gauge, Play } from "lucide-react";
import { PopoverHeader } from "./popover-header";

export default { title: "Components/Overlays/Popover header" };

export const TitledPopovers = () => (
  <Stack gap="md">
    <PopoverHeader icon={<Cloud />} title="Prompt Studio Cloud" />
    <PopoverHeader
      icon={<Gauge />}
      title="Performance"
      actions={
        <IconButton size="2xs" variant="ghost" aria-label="Copy performance snapshot">
          <Copy />
        </IconButton>
      }
    />
    <PopoverHeader icon={<Play />} title="Auto Build" />
  </Stack>
);
