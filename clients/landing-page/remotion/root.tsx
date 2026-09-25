import { Composition } from "remotion";
import { APPLE_TOUCH_ICON_SIZE, AppleTouchIcon } from "./apple-touch-icon";
import { BANNER_HEIGHT, BANNER_WIDTH, Banner } from "./banner";

// Both compositions are single frame stills rendered into public/images.
const STILL = { durationInFrames: 1, fps: 1 };

export const RemotionRoot = () => (
  <>
    <Composition id="Banner" component={Banner} width={BANNER_WIDTH} height={BANNER_HEIGHT} {...STILL} />
    <Composition
      id="AppleTouchIcon"
      component={AppleTouchIcon}
      width={APPLE_TOUCH_ICON_SIZE}
      height={APPLE_TOUCH_ICON_SIZE}
      {...STILL}
    />
  </>
);
