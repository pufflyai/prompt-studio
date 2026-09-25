import { Box } from "@chakra-ui/react";
import { BrandCanvas } from "./brand-canvas";
import { IconMark } from "./icon-mark";

export const APPLE_TOUCH_ICON_SIZE = 180;

export const AppleTouchIcon = () => (
  <BrandCanvas>
    <Box position="absolute" inset="0">
      <IconMark size={APPLE_TOUCH_ICON_SIZE} radius={0} />
    </Box>
  </BrandCanvas>
);
